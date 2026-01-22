-- Universal SRS System Migration
-- Creates unified cards, card_collections, and updates card_review_state

-- 1. Create universal cards table
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  front text not null,
  back text not null,
  front_lang text null,
  back_lang text null,
  pinyin text null,
  source_type text null,
  source_ref_id uuid null,
  created_at timestamptz not null default now()
);

-- 2. Create card_collections mapping table
create table if not exists public.card_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_type text not null check (collection_type in ('quiz_island', 'deck')),
  collection_id uuid not null,
  card_id uuid not null references cards(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, collection_type, collection_id, card_id)
);

-- 3. Update card_review_state to reference cards instead of flashcards
-- First, drop the old FK constraint
alter table public.card_review_state drop constraint if exists card_review_state_card_id_fkey;

-- Add new fields to card_review_state
alter table public.card_review_state add column if not exists state text default 'new';
alter table public.card_review_state add column if not exists lapses int default 0;
alter table public.card_review_state add column if not exists streak int default 0;
alter table public.card_review_state add column if not exists suspended bool default false;

-- Add new FK constraint to cards
alter table public.card_review_state 
  add constraint card_review_state_card_id_fkey 
  foreign key (card_id) references cards(id) on delete cascade;

-- 4. Create indexes
create index if not exists cards_user_id_created_at_idx on public.cards(user_id, created_at desc);
create index if not exists cards_source_type_ref_id_idx on public.cards(source_type, source_ref_id);
create index if not exists card_collections_user_collection_idx on public.card_collections(user_id, collection_type, collection_id);
create index if not exists card_collections_user_card_idx on public.card_collections(user_id, card_id);
create index if not exists card_review_state_user_due_idx on public.card_review_state(user_id, due_at) where not suspended;
create index if not exists card_review_state_user_suspended_idx on public.card_review_state(user_id, suspended);

-- 5. Enable RLS
alter table public.cards enable row level security;
alter table public.card_collections enable row level security;

-- 6. RLS Policies for cards
drop policy if exists "Users can view their own cards" on public.cards;
create policy "Users can view their own cards"
  on public.cards for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own cards" on public.cards;
create policy "Users can insert their own cards"
  on public.cards for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own cards" on public.cards;
create policy "Users can update their own cards"
  on public.cards for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own cards" on public.cards;
create policy "Users can delete their own cards"
  on public.cards for delete
  using (auth.uid() = user_id);

-- 7. RLS Policies for card_collections
drop policy if exists "Users can view their own card collections" on public.card_collections;
create policy "Users can view their own card collections"
  on public.card_collections for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own card collections" on public.card_collections;
create policy "Users can insert their own card collections"
  on public.card_collections for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own card collections" on public.card_collections;
create policy "Users can delete their own card collections"
  on public.card_collections for delete
  using (auth.uid() = user_id);

-- 8. Create RPC function: get_quiz_queue
create or replace function public.get_quiz_queue(
  p_quiz_island_id uuid,
  p_review_limit int default 80,
  p_new_limit int default 20
)
returns table (
  id uuid,
  front text,
  back text,
  pinyin text,
  front_lang text,
  back_lang text,
  review_state_id uuid,
  ease float,
  interval_days int,
  due_at timestamptz,
  state text
)
language plpgsql
security definer
as $$
begin
  return query
  with collection_cards as (
    select c.id, c.front, c.back, c.pinyin, c.front_lang, c.back_lang, c.created_at
    from cards c
    inner join card_collections cc on cc.card_id = c.id
    where cc.collection_type = 'quiz_island'
      and cc.collection_id = p_quiz_island_id
      and cc.user_id = auth.uid()
  ),
  due_reviews as (
    select 
      cc.id, cc.front, cc.back, cc.pinyin, cc.front_lang, cc.back_lang,
      crs.id as review_state_id, crs.ease, crs.interval_days, crs.due_at, crs.state
    from collection_cards cc
    inner join card_review_state crs on crs.card_id = cc.id and crs.user_id = auth.uid()
    where crs.due_at <= now() and not crs.suspended
    order by crs.due_at asc
    limit p_review_limit
  ),
  new_cards as (
    select 
      cc.id, cc.front, cc.back, cc.pinyin, cc.front_lang, cc.back_lang,
      null::uuid as review_state_id, null::float as ease, null::int as interval_days, 
      null::timestamptz as due_at, 'new'::text as state
    from collection_cards cc
    left join card_review_state crs on crs.card_id = cc.id and crs.user_id = auth.uid()
    where crs.id is null
    order by cc.created_at asc
    limit p_new_limit
  )
  select * from due_reviews
  union all
  select * from new_cards;
end;
$$;

-- 9. Create RPC function: grade_card
create or replace function public.grade_card(
  p_card_id uuid,
  p_rating text
)
returns json
language plpgsql
security definer
as $$
declare
  v_ease float;
  v_interval_days int;
  v_due_at timestamptz;
  v_state text;
  v_lapses int;
  v_streak int;
  v_existing_review record;
  v_result json;
begin
  -- Get existing review state
  select * into v_existing_review
  from card_review_state
  where card_id = p_card_id and user_id = auth.uid();

  -- Initialize defaults
  v_ease := coalesce(v_existing_review.ease, 2.5);
  v_interval_days := coalesce(v_existing_review.interval_days, 0);
  v_lapses := coalesce(v_existing_review.lapses, 0);
  v_streak := coalesce(v_existing_review.streak, 0);

  -- Apply SM2-like algorithm
  case p_rating
    when 'forgot' then
      v_lapses := v_lapses + 1;
      v_streak := 0;
      v_ease := greatest(1.3, v_ease - 0.2);
      v_state := 'relearning';
      v_interval_days := 0;
      v_due_at := now() + interval '10 minutes';
    
    when 'hard' then
      v_ease := greatest(1.3, v_ease - 0.05);
      v_interval_days := greatest(1, round(greatest(1, v_interval_days) * 1.2)::int);
      v_state := 'review';
      v_streak := v_streak + 1;
      v_due_at := now() + (v_interval_days || ' days')::interval;
    
    when 'good' then
      if v_interval_days <= 0 then
        v_interval_days := 1;
      else
        v_interval_days := greatest(1, round(v_interval_days * v_ease)::int);
      end if;
      v_state := 'review';
      v_streak := v_streak + 1;
      v_due_at := now() + (v_interval_days || ' days')::interval;
    
    when 'easy' then
      v_ease := v_ease + 0.15;
      if v_interval_days <= 0 then
        v_interval_days := 3;
      else
        v_interval_days := greatest(2, round(v_interval_days * (v_ease + 0.3))::int);
      end if;
      v_state := 'review';
      v_streak := v_streak + 1;
      v_due_at := now() + (v_interval_days || ' days')::interval;
    
    else
      raise exception 'Invalid rating: %', p_rating;
  end case;

  -- Upsert review state
  insert into card_review_state (
    user_id, card_id, ease, interval_days, due_at, last_reviewed_at, state, lapses, streak
  ) values (
    auth.uid(), p_card_id, v_ease, v_interval_days, v_due_at, now(), v_state, v_lapses, v_streak
  )
  on conflict (user_id, card_id) do update set
    ease = v_ease,
    interval_days = v_interval_days,
    due_at = v_due_at,
    last_reviewed_at = now(),
    state = v_state,
    lapses = v_lapses,
    streak = v_streak;

  -- Return updated state
  select json_build_object(
    'ease', v_ease,
    'interval_days', v_interval_days,
    'due_at', v_due_at,
    'state', v_state,
    'lapses', v_lapses,
    'streak', v_streak
  ) into v_result;

  return v_result;
end;
$$;

-- 10. Create RPC function: get_quiz_stats
create or replace function public.get_quiz_stats(
  p_quiz_island_id uuid
)
returns table (
  forgot_count bigint,
  hard_count bigint,
  good_count bigint,
  easy_count bigint,
  new_count bigint,
  total_count bigint
)
language plpgsql
security definer
as $$
begin
  return query
  with collection_cards as (
    select c.id
    from cards c
    inner join card_collections cc on cc.card_id = c.id
    where cc.collection_type = 'quiz_island'
      and cc.collection_id = p_quiz_island_id
      and cc.user_id = auth.uid()
  )
  select
    count(*) filter (where crs.state = 'relearning' or (crs.interval_days = 0 and crs.lapses > 0)) as forgot_count,
    count(*) filter (where crs.interval_days between 1 and 3) as hard_count,
    count(*) filter (where crs.interval_days between 4 and 14) as good_count,
    count(*) filter (where crs.interval_days >= 15) as easy_count,
    count(*) filter (where crs.id is null) as new_count,
    count(*) as total_count
  from collection_cards cc
  left join card_review_state crs on crs.card_id = cc.id and crs.user_id = auth.uid();
end;
$$;

