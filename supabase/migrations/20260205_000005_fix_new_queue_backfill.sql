-- Fix: Backfill new queue from existing cards that should be there
-- This handles the transition for users who already had cards before the new queue system

-- Populate new queue with existing cards that:
-- 1. Have low review counts (new-ish cards)
-- 2. Are in 'new' state or have low intervals
-- 3. Up to 10 per quiz island

do $$
declare
  v_island record;
  v_cards_needed int;
begin
  -- For each quiz island
  for v_island in 
    select distinct cc.collection_id as island_id, cc.user_id
    from card_collections cc
    where cc.collection_type = 'quiz_island'
  loop
    -- Count how many cards are already in the new queue for this island
    select 10 - count(*) into v_cards_needed
    from card_review_state crs
    inner join card_collections cc on cc.card_id = crs.card_id
    where cc.collection_type = 'quiz_island'
      and cc.collection_id = v_island.island_id
      and cc.user_id = v_island.user_id
      and crs.user_id = v_island.user_id
      and crs.in_new_queue = true;

    -- If we need cards, populate from existing low-progress cards
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
          and (
            crs2.state = 'new' 
            or crs2.interval_days <= 3
            or crs2.mastery_tier in ('learning', 'hard', 'relearning')
          )
        order by crs2.interval_days asc, crs2.created_at asc
        limit v_cards_needed
      );
    end if;
  end loop;
end;
$$;

-- Update ensure_new_queue_populated to also consider existing low-progress cards
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
      and crs.id is null  -- Never seen
    order by c.created_at asc
    limit v_needed
    on conflict (user_id, card_id) do nothing;

    -- Check how many we added
    get diagnostics v_added = row_count;
    v_needed := v_needed - v_added;

    -- If we still need more, promote existing low-progress cards to the new queue
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
          and (
            crs2.state = 'new'
            or crs2.interval_days <= 3
            or crs2.mastery_tier in ('learning', 'hard', 'relearning')
          )
        order by crs2.interval_days asc, crs2.created_at asc
        limit v_needed
      );
    end if;
  end if;
end;
$$;
