-- SRS improvements: mastery tier (easy/good/hard stack) and better grading
-- - First-time "Easy" puts card in easy stack (accomplishment)
-- - Later "Hard" or "Forgot" moves card to hard stack; takes more effort to return to easy
-- - Max interval cap, clearer progression

-- 1. Add mastery_tier to card_review_state
alter table public.card_review_state
  add column if not exists mastery_tier text default 'learning';

comment on column public.card_review_state.mastery_tier is
  'User-facing stack: easy (mastered), good, hard (needs more practice), relearning';

-- Backfill existing rows from current state/interval
update public.card_review_state
set mastery_tier = case
  when state = 'relearning' or (interval_days = 0 and lapses > 0) then 'relearning'
  when interval_days >= 15 then 'easy'
  when interval_days between 4 and 14 then 'good'
  when interval_days between 1 and 3 then 'hard'
  else 'learning'
end
where mastery_tier is null or mastery_tier = 'learning';

-- 2. Replace grade_card with tier-aware logic and improved SRS
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

  -- Upsert with mastery_tier
  insert into card_review_state (
    user_id, card_id, ease, interval_days, due_at, last_reviewed_at, state, lapses, streak, mastery_tier
  ) values (
    auth.uid(), p_card_id, v_ease, v_interval_days, v_due_at, now(), v_state, v_lapses, v_streak, v_tier
  )
  on conflict (user_id, card_id) do update set
    ease = excluded.ease,
    interval_days = excluded.interval_days,
    due_at = excluded.due_at,
    last_reviewed_at = now(),
    state = excluded.state,
    lapses = excluded.lapses,
    streak = excluded.streak,
    mastery_tier = excluded.mastery_tier;

  select json_build_object(
    'ease', v_ease,
    'interval_days', v_interval_days,
    'due_at', v_due_at,
    'state', v_state,
    'lapses', v_lapses,
    'streak', v_streak,
    'mastery_tier', v_tier
  ) into v_result;

  return v_result;
end;
$$;

-- 3. get_quiz_stats: use mastery_tier for easy/hard stack counts (accomplishment view)
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
    count(*) filter (where coalesce(crs.mastery_tier, 'relearning') = 'relearning') as forgot_count,
    count(*) filter (where crs.mastery_tier = 'hard') as hard_count,
    count(*) filter (where crs.mastery_tier = 'good') as good_count,
    count(*) filter (where crs.mastery_tier = 'easy') as easy_count,
    count(*) filter (where crs.id is null) as new_count,
    count(*) as total_count
  from collection_cards cc
  left join card_review_state crs on crs.card_id = cc.id and crs.user_id = auth.uid();
end;
$$;
