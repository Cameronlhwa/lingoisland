-- Fix: Cards in new queue should be treated as "new" when first graded
-- The issue: ensure_new_queue_populated sets interval_days = 1, but v_is_new_card checks for interval_days <= 0

-- Update ensure_new_queue_populated to set interval_days = 0 for new cards
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
    -- Add never-seen cards with interval_days = 0 so v_is_new_card works
    insert into card_review_state (
      user_id, card_id, in_new_queue, new_queue_easy_count,
      ease, interval_days, due_at, last_reviewed_at, state, lapses, streak, mastery_tier
    )
    select
      auth.uid(), c.id, true, 0,
      2.5, 0, now(), null, 'new', 0, 0, 'new'
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

-- Fix existing cards in new queue that have interval_days = 1
update card_review_state
set interval_days = 0
where in_new_queue = true 
  and interval_days = 1 
  and state = 'new'
  and last_reviewed_at is null;
