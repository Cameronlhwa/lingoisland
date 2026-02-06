-- Debug query to see what's happening with cards
-- Run this first to see the data:
/*
SELECT 
  c.id as card_id,
  c.front,
  c.back,
  cc.collection_id as quiz_island_id,
  crs.mastery_tier,
  crs.in_new_queue,
  crs.interval_days,
  crs.state,
  crs.last_reviewed_at
FROM cards c
LEFT JOIN card_collections cc ON cc.card_id = c.id AND cc.collection_type = 'quiz_island'
LEFT JOIN card_review_state crs ON crs.card_id = c.id AND crs.user_id = c.user_id
WHERE c.user_id = auth.uid()
ORDER BY c.created_at DESC
LIMIT 20;
*/

-- The issue: get_quiz_stats uses a LEFT JOIN but only counts where crs.id exists
-- If cards were never added to card_review_state (never quizzed), they won't show in any bucket

-- Also, the stats query has a bug: it's not counting cards in the new queue as "new"
-- Cards with in_new_queue = true that haven't been graded should appear somewhere

-- Fix get_quiz_stats to properly handle all card states
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
      and c.user_id = auth.uid()  -- Added: ensure card belongs to user too
  )
  select
    count(*) filter (where crs.mastery_tier = 'relearning') as forgot_count,
    count(*) filter (where crs.mastery_tier = 'hard') as hard_count,
    count(*) filter (where crs.mastery_tier = 'good') as good_count,
    count(*) filter (where crs.mastery_tier = 'easy') as easy_count,
    count(*) filter (where crs.id is null or (crs.in_new_queue = true and crs.last_reviewed_at is null)) as new_count,
    count(*) filter (where crs.in_new_queue = true and crs.last_reviewed_at is not null) as new_queue_count,
    count(*) as total_count
  from collection_cards cc
  left join card_review_state crs on crs.card_id = cc.id and crs.user_id = auth.uid();
end;
$$;

-- Also ensure that when cards are added to new queue initially, they show as "new"
-- Until they are reviewed at least once
