-- COMPREHENSIVE DEBUG AND FIX
-- This will show you what's in your database and fix any issues

-- Step 1: See what cards exist and their state
-- Uncomment and run this to see your data:
/*
SELECT 
  'Card Info' as section,
  c.id,
  c.front,
  c.back,
  c.user_id as card_user_id,
  cc.collection_id as quiz_island_id,
  cc.user_id as collection_user_id,
  crs.id as review_state_id,
  crs.mastery_tier,
  crs.in_new_queue,
  crs.interval_days,
  crs.state,
  crs.last_reviewed_at,
  crs.user_id as review_user_id
FROM cards c
LEFT JOIN card_collections cc ON cc.card_id = c.id AND cc.collection_type = 'quiz_island'
LEFT JOIN card_review_state crs ON crs.card_id = c.id
WHERE c.created_at > now() - interval '1 hour'  -- Cards created in last hour
ORDER BY c.created_at DESC;
*/

-- Step 2: Fix any cards that are missing card_review_state after being graded
-- This ensures any card that should have review state gets it

-- Step 3: Update get_quiz_stats with better logic
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
    -- Get all card IDs for this quiz island
    select cc.card_id as id
    from card_collections cc
    where cc.collection_type = 'quiz_island'
      and cc.collection_id = p_quiz_island_id
      and cc.user_id = auth.uid()
  )
  select
    count(*) filter (where crs.mastery_tier = 'relearning') as forgot_count,
    count(*) filter (where crs.mastery_tier = 'hard') as hard_count,
    count(*) filter (where crs.mastery_tier = 'good') as good_count,
    count(*) filter (where crs.mastery_tier = 'easy') as easy_count,
    -- New: cards with no review state OR in new queue but never reviewed
    count(*) filter (where crs.id is null or (crs.in_new_queue = true and crs.last_reviewed_at is null)) as new_count,
    -- New queue: cards actively being introduced (in queue and have been reviewed at least once)
    count(*) filter (where crs.in_new_queue = true and crs.last_reviewed_at is not null) as new_queue_count,
    count(*) as total_count
  from collection_cards cc
  left join card_review_state crs on crs.card_id = cc.id and crs.user_id = auth.uid();
end;
$$;

-- Step 4: Create a helper function to diagnose issues
create or replace function public.debug_quiz_island(
  p_quiz_island_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_result json;
begin
  select json_build_object(
    'quiz_island_exists', exists(
      select 1 from quiz_islands 
      where id = p_quiz_island_id and user_id = auth.uid()
    ),
    'card_count', (
      select count(*) 
      from card_collections 
      where collection_id = p_quiz_island_id 
        and collection_type = 'quiz_island'
        and user_id = auth.uid()
    ),
    'cards_with_review_state', (
      select count(distinct crs.card_id)
      from card_review_state crs
      inner join card_collections cc on cc.card_id = crs.card_id
      where cc.collection_id = p_quiz_island_id
        and cc.collection_type = 'quiz_island'
        and cc.user_id = auth.uid()
        and crs.user_id = auth.uid()
    ),
    'cards_in_new_queue', (
      select count(*)
      from card_review_state crs
      inner join card_collections cc on cc.card_id = crs.card_id
      where cc.collection_id = p_quiz_island_id
        and cc.collection_type = 'quiz_island'
        and cc.user_id = auth.uid()
        and crs.user_id = auth.uid()
        and crs.in_new_queue = true
    ),
    'mastery_breakdown', (
      select json_object_agg(
        coalesce(mastery_tier, 'null'),
        cnt
      )
      from (
        select crs.mastery_tier, count(*) as cnt
        from card_review_state crs
        inner join card_collections cc on cc.card_id = crs.card_id
        where cc.collection_id = p_quiz_island_id
          and cc.collection_type = 'quiz_island'
          and cc.user_id = auth.uid()
          and crs.user_id = auth.uid()
        group by crs.mastery_tier
      ) sub
    )
  ) into v_result;
  
  return v_result;
end;
$$;

-- To use the debug function, run in SQL editor:
-- SELECT debug_quiz_island('your-quiz-island-id-here');
