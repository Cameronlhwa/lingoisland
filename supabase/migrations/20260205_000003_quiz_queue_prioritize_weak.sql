-- Quiz queue: prioritize weaker cards (relearning, new, hard first), then good, easy.
-- Return mastery_tier and order so user can go through all cards while strengthening known ones.

drop function if exists public.get_quiz_queue(uuid, integer, integer);

create or replace function public.get_quiz_queue(
  p_quiz_island_id uuid,
  p_review_limit int default 120,
  p_new_limit int default 10
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
  return query
  with collection_cards as (
    select c.id, c.front, c.back, c.pinyin, c.front_lang, c.back_lang, c.created_at
    from cards c
    inner join card_collections cc on cc.card_id = c.id
    where cc.collection_type = 'quiz_island'
      and cc.collection_id = p_quiz_island_id
      and cc.user_id = auth.uid()
  ),
  review_cards as (
    select
      cc.id, cc.front, cc.back, cc.pinyin, cc.front_lang, cc.back_lang,
      crs.id as review_state_id, crs.ease, crs.interval_days, crs.due_at, crs.state,
      case when crs.due_at <= now() then 'due' else 'review' end as queue_bucket,
      coalesce(crs.mastery_tier, 'learning') as mastery_tier
    from collection_cards cc
    inner join card_review_state crs on crs.card_id = cc.id and crs.user_id = auth.uid()
    where not crs.suspended
    limit p_review_limit
  ),
  new_cards as (
    select
      cc.id, cc.front, cc.back, cc.pinyin, cc.front_lang, cc.back_lang,
      null::uuid as review_state_id, null::float as ease, null::int as interval_days,
      null::timestamptz as due_at, 'new'::text as state, 'new'::text as queue_bucket,
      'new'::text as mastery_tier
    from collection_cards cc
    left join card_review_state crs on crs.card_id = cc.id and crs.user_id = auth.uid()
    where crs.id is null
    order by cc.created_at asc
    limit p_new_limit
  ),
  combined as (
    select * from review_cards
    union all
    select * from new_cards
  )
  select
    c.id, c.front, c.back, c.pinyin, c.front_lang, c.back_lang,
    c.review_state_id, c.ease, c.interval_days, c.due_at, c.state, c.queue_bucket,
    c.mastery_tier
  from combined c
  order by
    case c.mastery_tier
      when 'relearning' then 1
      when 'new' then 2
      when 'hard' then 3
      when 'good' then 4
      when 'easy' then 5
      else 9
    end,
    c.due_at asc nulls last;
end;
$$;
