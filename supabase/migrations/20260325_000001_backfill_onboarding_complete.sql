-- Users who already used the app before journey onboarding should not be forced
-- through /app/onboarding. The column defaulted to false for everyone when added.
update public.profiles p
set onboarding_complete = true
where p.onboarding_complete = false
  and (
    exists (
      select 1
      from public.topic_islands ti
      where ti.user_id = p.id
    )
    or exists (
      select 1
      from public.journeys j
      where j.user_id = p.id
    )
    or p.active_journey_id is not null
    or exists (
      select 1
      from public.stories s
      where s.user_id = p.id
    )
    or exists (
      select 1
      from public.decks d
      where d.user_id = p.id
    )
    or exists (
      select 1
      from public.usage_monthly u
      where u.user_id = p.id
        and (u.topic_islands_created > 0 or u.stories_created > 0)
    )
  );
