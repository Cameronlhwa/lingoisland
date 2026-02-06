-- COMPREHENSIVE FIX: Complete quiz system repair
-- Safe to run multiple times (idempotent)
-- Fixes the broken quiz issue and restores all progress

-- ==================================================
-- PART 1: Ensure all required columns exist
-- ==================================================

-- Add mastery_tier if it doesn't exist
do $$ 
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'card_review_state' 
    and column_name = 'mastery_tier'
  ) then
    alter table public.card_review_state
      add column mastery_tier text default 'learning';
    
    comment on column public.card_review_state.mastery_tier is
      'User-facing stack: easy (mastered), good, hard (needs more practice), relearning';
  end if;
end $$;

-- Add new queue columns if they don't exist
do $$ 
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_name = 'card_review_state' 
    and column_name = 'in_new_queue'
  ) then
    alter table public.card_review_state
      add column in_new_queue boolean default false,
      add column new_queue_easy_count int default 0;
    
    comment on column public.card_review_state.in_new_queue is
      'True if card is in the active new queue (being introduced to user)';
    comment on column public.card_review_state.new_queue_easy_count is
      'Count of Easy ratings while in new queue; graduates at 2';
  end if;
end $$;

-- Create indexes
create index if not exists card_review_state_new_queue_idx
  on public.card_review_state(user_id, in_new_queue)
  where in_new_queue = true;

-- ==================================================
-- PART 2: Backfill mastery_tier for existing cards
-- ==================================================

update public.card_review_state
set mastery_tier = case
  when state = 'relearning' or (interval_days = 0 and lapses > 0) then 'relearning'
  when interval_days >= 15 then 'easy'
  when interval_days between 4 and 14 then 'good'
  when interval_days between 1 and 3 then 'hard'
  else 'learning'
end
where mastery_tier is null or mastery_tier = 'learning';

-- ==================================================
-- PART 3: Populate new queue from existing cards
-- ==================================================

-- For each quiz island, add up to 10 cards to the new queue
do $$
declare
  v_island record;
  v_cards_needed int;
begin
  for v_island in 
    select distinct cc.collection_id as island_id, cc.user_id
    from card_collections cc
    where cc.collection_type = 'quiz_island'
  loop
    -- Count how many cards are already in the new queue
    select 10 - count(*) into v_cards_needed
    from card_review_state crs
    inner join card_collections cc on cc.card_id = crs.card_id
    where cc.collection_type = 'quiz_island'
      and cc.collection_id = v_island.island_id
      and cc.user_id = v_island.user_id
      and crs.user_id = v_island.user_id
      and crs.in_new_queue = true;

    -- Add cards to new queue (prioritize cards with low progress)
    if v_cards_needed > 0 then
      update card_review_state crs
      set in_new_queue = true,
          new_queue_easy_count = 0
      where crs.id in (
        select crs2.id
        from card_review_state crs2
        inner join card_collections cc on cc.card_id = crs2.card_id
        where cc.collection_type = 'quiz_island'
          and cc.collection_id = v_island.island_id
          and cc.user_id = v_island.user_id
          and crs2.user_id = v_island.user_id
          and crs2.in_new_queue = false
        order by crs2.interval_days asc, crs2.created_at asc
        limit v_cards_needed
      );
    end if;
  end loop;
end;
$$;

-- ==================================================
-- PART 4: Create/Update ensure_new_queue_populated function
-- ==================================================

create or replace function public.ensure_new_queue_populated(
  p_quiz_island_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
  v_current_count int;
  v_needed int;
  v_added int;
begin
  -- Count cards currently in new queue
  select count(*) into v_current_count
  from card_review_state crs
  inner join card_collections cc on cc.card_id = crs.card_id
  where cc.collection_type = 'quiz_island'
    and cc.collection_id = p_quiz_island_id
    and cc.user_id = auth.uid()
    and crs.user_id = auth.uid()
    and crs.in_new_queue = true;

  v_needed := 10 - v_current_count;

  if v_needed > 0 then
    -- First, try to add never-seen cards
    insert into card_review_state (
      user_id, card_id, in_new_queue, new_queue_easy_count,
      ease, interval_days, due_at, last_reviewed_at, state, lapses, streak, mastery_tier
    )
    select
      auth.uid(), c.id, true, 0,
      2.5, 1, now(), null, 'new', 0, 0, 'new'
    from cards c
    inner join card_collections cc on cc.card_id = c.id
    left join card_review_state crs on crs.card_id = c.id and crs.user_id = auth.uid()
    where cc.collection_type = 'quiz_island'
      and cc.collection_id = p_quiz_island_id
      and cc.user_id = auth.uid()
      and crs.id is null
    order by c.created_at asc
    limit v_needed
    on conflict (user_id, card_id) do nothing;

    get diagnostics v_added = row_count;
    v_needed := v_needed - v_added;

    -- If still need more, promote existing low-progress cards
    if v_needed > 0 then
      update card_review_state crs
      set in_new_queue = true,
          new_queue_easy_count = 0
      where crs.id in (
        select crs2.id
        from card_review_state crs2
        inner join card_collections cc on cc.card_id = crs2.card_id
        where cc.collection_type = 'quiz_island'
          and cc.collection_id = p_quiz_island_id
          and cc.user_id = auth.uid()
          and crs2.user_id = auth.uid()
          and crs2.in_new_queue = false
        order by crs2.interval_days asc, crs2.created_at asc
        limit v_needed
      );
    end if;
  end if;
end;
$$;

-- ==================================================
-- PART 5: Update get_quiz_queue (70% new, 30% review)
-- ==================================================

drop function if exists public.get_quiz_queue(uuid, integer, integer);

create or replace function public.get_quiz_queue(
  p_quiz_island_id uuid,
  p_new_limit int default 7,
  p_review_limit int default 3
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
  state text,
  queue_bucket text,
  mastery_tier text
)
language plpgsql
security definer
as $$
begin
  perform ensure_new_queue_populated(p_quiz_island_id);

  return query
  with collection_cards as (
    select c.id, c.front, c.back, c.pinyin, c.front_lang, c.back_lang, c.created_at
    from cards c
    inner join card_collections cc on cc.card_id = c.id
    where cc.collection_type = 'quiz_island'
      and cc.collection_id = p_quiz_island_id
      and cc.user_id = auth.uid()
  ),
  new_queue_cards as (
    select
      cc.id, cc.front, cc.back, cc.pinyin, cc.front_lang, cc.back_lang,
      crs.id as review_state_id, crs.ease, crs.interval_days, crs.due_at, crs.state,
      'new_queue'::text as queue_bucket,
      coalesce(crs.mastery_tier, 'new') as mastery_tier
    from collection_cards cc
    inner join card_review_state crs on crs.card_id = cc.id and crs.user_id = auth.uid()
    where crs.in_new_queue = true
    order by crs.due_at asc, cc.created_at asc
    limit p_new_limit
  ),
  review_queue_cards as (
    select
      cc.id, cc.front, cc.back, cc.pinyin, cc.front_lang, cc.back_lang,
      crs.id as review_state_id, crs.ease, crs.interval_days, crs.due_at, crs.state,
      'review'::text as queue_bucket,
      coalesce(crs.mastery_tier, 'learning') as mastery_tier
    from collection_cards cc
    inner join card_review_state crs on crs.card_id = cc.id and crs.user_id = auth.uid()
    where (crs.in_new_queue = false or crs.in_new_queue is null)
      and not coalesce(crs.suspended, false)
    order by
      case crs.mastery_tier
        when 'relearning' then 1
        when 'hard' then 2
        when 'good' then 3
        when 'easy' then 4
        else 9
      end,
      crs.due_at asc
    limit p_review_limit
  ),
  combined as (
    select *, 1 as priority from new_queue_cards
    union all
    select *, 2 as priority from review_queue_cards
  )
  select
    c.id, c.front, c.back, c.pinyin, c.front_lang, c.back_lang,
    c.review_state_id, c.ease, c.interval_days, c.due_at, c.state, c.queue_bucket,
    c.mastery_tier
  from combined c
  order by c.priority, c.due_at asc nulls last;
end;
$$;

-- ==================================================
-- PART 6: Update grade_card with new queue graduation
-- ==================================================

drop function if exists public.grade_card(uuid, text);

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
  v_tier text;
  v_in_new_queue boolean;
  v_new_queue_easy_count int;
  v_existing_review record;
  v_result json;
  v_is_new_card boolean;
  v_max_interval int := 90;
begin
  select * into v_existing_review
  from card_review_state
  where card_id = p_card_id and user_id = auth.uid();

  v_is_new_card := v_existing_review.id is null
    or (coalesce(v_existing_review.interval_days, 0) <= 0
        and v_existing_review.state in ('new', 'relearning'));

  v_ease := coalesce(v_existing_review.ease, 2.5);
  v_interval_days := coalesce(v_existing_review.interval_days, 0);
  v_lapses := coalesce(v_existing_review.lapses, 0);
  v_streak := coalesce(v_existing_review.streak, 0);
  v_tier := coalesce(v_existing_review.mastery_tier, 'learning');
  v_in_new_queue := coalesce(v_existing_review.in_new_queue, false);
  v_new_queue_easy_count := coalesce(v_existing_review.new_queue_easy_count, 0);

  case p_rating
    when 'forgot' then
      v_lapses := v_lapses + 1;
      v_streak := 0;
      v_ease := greatest(1.3, v_ease - 0.2);
      v_state := 'relearning';
      v_interval_days := 0;
      v_due_at := now() + interval '10 minutes';
      v_tier := 'relearning';

    when 'hard' then
      if v_is_new_card then
        v_tier := 'hard';
      elsif v_tier in ('easy', 'good') then
        v_tier := 'hard';
      end if;
      v_ease := greatest(1.3, v_ease - 0.08);
      v_interval_days := least(v_max_interval, greatest(1, round(greatest(1, v_interval_days) * 1.15)::int));
      v_state := 'review';
      v_streak := v_streak + 1;
      v_due_at := now() + (v_interval_days || ' days')::interval;

    when 'good' then
      if v_is_new_card then
        v_tier := 'good';
      elsif v_tier = 'hard' then
        v_tier := 'good';
      end if;
      if v_interval_days <= 0 then
        v_interval_days := 1;
      else
        v_interval_days := least(v_max_interval, greatest(1, round(v_interval_days * v_ease)::int));
      end if;
      v_state := 'review';
      v_streak := v_streak + 1;
      v_due_at := now() + (v_interval_days || ' days')::interval;

    when 'easy' then
      if v_is_new_card then
        v_tier := 'easy';
        v_ease := least(2.8, v_ease + 0.15);
        v_interval_days := 4;
        v_state := 'review';
        v_streak := v_streak + 1;
        v_due_at := now() + interval '4 days';
      else
        if v_tier in ('relearning', 'hard') then
          v_tier := 'good';
        elsif v_tier = 'good' then
          v_tier := 'easy';
        end if;
        v_ease := least(2.8, v_ease + 0.15);
        if v_interval_days <= 0 then
          v_interval_days := 3;
        else
          v_interval_days := least(v_max_interval, greatest(2, round(v_interval_days * (v_ease + 0.25))::int));
        end if;
        v_state := 'review';
        v_streak := v_streak + 1;
        v_due_at := now() + (v_interval_days || ' days')::interval;
      end if;

    else
      raise exception 'Invalid rating: %', p_rating;
  end case;

  -- Handle new queue graduation
  if v_in_new_queue = true and p_rating = 'easy' then
    v_new_queue_easy_count := v_new_queue_easy_count + 1;
    if v_new_queue_easy_count >= 2 then
      v_in_new_queue := false;
      v_new_queue_easy_count := 0;
    end if;
  end if;

  insert into card_review_state (
    user_id, card_id, ease, interval_days, due_at, last_reviewed_at, state, lapses, streak, mastery_tier,
    in_new_queue, new_queue_easy_count
  ) values (
    auth.uid(), p_card_id, v_ease, v_interval_days, v_due_at, now(), v_state, v_lapses, v_streak, v_tier,
    v_in_new_queue, v_new_queue_easy_count
  )
  on conflict (user_id, card_id) do update set
    ease = excluded.ease,
    interval_days = excluded.interval_days,
    due_at = excluded.due_at,
    last_reviewed_at = now(),
    state = excluded.state,
    lapses = excluded.lapses,
    streak = excluded.streak,
    mastery_tier = excluded.mastery_tier,
    in_new_queue = excluded.in_new_queue,
    new_queue_easy_count = excluded.new_queue_easy_count;

  select json_build_object(
    'ease', v_ease,
    'interval_days', v_interval_days,
    'due_at', v_due_at,
    'state', v_state,
    'lapses', v_lapses,
    'streak', v_streak,
    'mastery_tier', v_tier,
    'in_new_queue', v_in_new_queue,
    'new_queue_easy_count', v_new_queue_easy_count
  ) into v_result;

  return v_result;
end;
$$;

-- ==================================================
-- PART 7: Update get_quiz_stats
-- ==================================================

drop function if exists public.get_quiz_stats(uuid);

create or replace function public.get_quiz_stats(
  p_quiz_island_id uuid
)
returns table (
  forgot_count bigint,
  hard_count bigint,
  good_count bigint,
  easy_count bigint,
  new_count bigint,
  new_queue_count bigint,
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
    count(*) filter (where coalesce(crs.mastery_tier, 'relearning') = 'relearning') as forgot_count,
    count(*) filter (where crs.mastery_tier = 'hard') as hard_count,
    count(*) filter (where crs.mastery_tier = 'good') as good_count,
    count(*) filter (where crs.mastery_tier = 'easy') as easy_count,
    count(*) filter (where crs.id is null) as new_count,
    count(*) filter (where crs.in_new_queue = true) as new_queue_count,
    count(*) as total_count
  from collection_cards cc
  left join card_review_state crs on crs.card_id = cc.id and crs.user_id = auth.uid();
end;
$$;

-- ==================================================
-- DONE! Your quiz should now work with:
-- - 70% new cards (7 per session)
-- - 30% review cards (3 per session)
-- - All your progress preserved
-- ==================================================
