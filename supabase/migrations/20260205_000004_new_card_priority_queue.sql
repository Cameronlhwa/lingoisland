-- New Card Priority Queue System
-- Maintains a queue of 10 new cards per quiz island; 70% of session is new cards, 30% review
-- Cards graduate from new queue after receiving Easy rating 2 times

-- 1. Add new queue columns to card_review_state
alter table public.card_review_state
  add column if not exists in_new_queue boolean default false,
  add column if not exists new_queue_easy_count int default 0;

comment on column public.card_review_state.in_new_queue is
  'True if card is in the active new queue (being introduced to user)';
comment on column public.card_review_state.new_queue_easy_count is
  'Count of Easy ratings while in new queue; graduates at 2';

-- Create index for efficient new queue lookups
create index if not exists card_review_state_new_queue_idx
  on public.card_review_state(user_id, in_new_queue)
  where in_new_queue = true;

-- 2. Create function to ensure new queue is populated with 10 cards
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
begin
  -- Count cards currently in new queue for this island
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
    -- Get oldest never-seen cards and add to new queue
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
      and crs.id is null  -- Never seen
    order by c.created_at asc
    limit v_needed
    on conflict (user_id, card_id) do nothing;
  end if;
end;
$$;

-- 3. Replace get_quiz_queue with 70/30 new-to-review ratio
drop function if exists public.get_quiz_queue(uuid, integer, integer);

create or replace function public.get_quiz_queue(
  p_quiz_island_id uuid,
  p_new_limit int default 7,      -- 70% of 10-card session
  p_review_limit int default 3    -- 30% of 10-card session
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
  -- Ensure new queue is populated (auto-refill as cards graduate)
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
    order by crs.due_at asc, cc.created_at asc  -- Prioritize oldest and due soonest
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
  order by c.priority, c.due_at asc nulls last;  -- New queue first, then review
end;
$$;

-- 4. Update grade_card to handle new queue graduation
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

  -- New card = no review state yet, or never graduated (interval 0, state new/relearning)
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

  -- Apply tier-aware SM2-like algorithm
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
      -- First time: go to hard stack; later: demote from easy or good to hard
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
      -- First time: go to good stack; later: from hard we move to good (good never demotes easy)
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
        -- First time: Easy → easy stack (accomplishment), skip ahead
        v_tier := 'easy';
        v_ease := least(2.8, v_ease + 0.15);
        v_interval_days := 4;
        v_state := 'review';
        v_streak := v_streak + 1;
        v_due_at := now() + interval '4 days';
      else
        -- Later: from relearning/hard → good; from good → easy (one step at a time)
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
      -- Graduate from new queue
      v_in_new_queue := false;
      v_new_queue_easy_count := 0;  -- Reset counter
    end if;
  end if;

  -- Upsert with mastery_tier and new queue fields
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

-- 5. Update get_quiz_stats to include new queue count
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
