-- Part 0: HSK Path reset. DO NOT RUN until Cameron approves.
-- Scope: curriculum-linked journeys + hsk_word cards + curricula + profile HSK answers.
-- Leaves: hsk_words, practice tests, product_subscriptions, core Islands journeys.

begin;

-- 1. Drop pointers first
update public.user_profiles
set active_curriculum_id = null
where active_curriculum_id is not null;

update public.profiles p
set active_journey_id = null
where exists (
  select 1
  from public.journeys j
  where j.id = p.active_journey_id
    and j.curriculum_unit_id is not null
);

-- 2–4. Capture topic islands / stories linked to curriculum journeys, then delete journeys
-- (cascades journey_islands → journey_island_hsk_words).
create temporary table _hsk_path_islands as
select distinct ji.island_id
from public.journey_islands ji
join public.journeys j on j.id = ji.journey_id
where j.curriculum_unit_id is not null
  and ji.island_id is not null;

create temporary table _hsk_path_stories as
select distinct ji.story_id
from public.journey_islands ji
join public.journeys j on j.id = ji.journey_id
where j.curriculum_unit_id is not null
  and ji.story_id is not null;

delete from public.journeys
where curriculum_unit_id is not null;

delete from public.topic_islands
where id in (select island_id from _hsk_path_islands);

delete from public.stories
where id in (select story_id from _hsk_path_stories);

-- 5–6. HSK SRS cards (review_state cascades). Collections that pointed at them too.
delete from public.card_collections
where card_id in (
  select id from public.cards where source_type = 'hsk_word'
);

delete from public.cards
where source_type = 'hsk_word';

-- 7. Curricula cascade curriculum_units
delete from public.curricula;

-- 8. Reset HSK onboarding answers; leave billing / product_track / flashcard deck pointer
update public.user_profiles
set
  hsk_current_level = null,
  hsk_level_source = null,
  hsk_target_level = null,
  test_date = null,
  hsk_motivation = null,
  hsk_personalization_text = null,
  daily_time_minutes = null,
  interests = '{}',
  active_curriculum_id = null;

commit;

-- Also clear client sessionStorage key: hsk_onboarding_draft_v1 and hsk_onboarding_draft_v2
