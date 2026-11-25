alter table public.pronunciation_sessions drop constraint if exists pronunciation_sessions_source_check;
alter table public.pronunciation_sessions add constraint pronunciation_sessions_source_check
  check (source in ('journey_node', 'standalone', 'weak_sounds_focus', 'journey_lesson'));

-- One immutable content snapshot and resumable checkpoint per journey island.
create table if not exists public.journey_lessons (
  island_id uuid primary key references public.topic_islands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  objective jsonb not null,
  content jsonb,
  writing_approval jsonb,
  progress jsonb not null default '{"stepId":"vocabulary"}'::jsonb,
  revision integer not null default 0 check (revision >= 0),
  pronunciation_session_id uuid references public.pronunciation_sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists journey_lessons_user_id_idx on public.journey_lessons(user_id);
create or replace function public.preserve_journey_lesson_content() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.island_id is distinct from old.island_id or new.user_id is distinct from old.user_id
     or new.objective is distinct from old.objective then
    raise exception 'A saved lesson cannot change its owner or objective';
  end if;
  if old.content is not null and new.content is distinct from old.content then
    raise exception 'Saved lesson content is immutable';
  end if;
  return new;
end;
$$;
create trigger preserve_journey_lesson_content before update on public.journey_lessons
  for each row execute function public.preserve_journey_lesson_content();
alter table public.journey_lessons enable row level security;
-- Ownership is enforced for both reads and writes.
create policy "Read own journey lessons" on public.journey_lessons
  for select to authenticated using (auth.uid() = user_id);
-- Server routes use the caller's Supabase session, so writes need ownership policies too.
create policy "Insert own journey lessons" on public.journey_lessons
  for insert to authenticated with check (auth.uid() = user_id and exists (
    select 1 from public.topic_islands i join public.journey_islands n on n.island_id = i.id
    join public.journeys j on j.id = n.journey_id
    where i.id = journey_lessons.island_id and i.user_id = auth.uid() and j.user_id = auth.uid()
  ));
create policy "Update own journey lessons" on public.journey_lessons
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id and exists (
    select 1 from public.topic_islands i join public.journey_islands n on n.island_id = i.id
    join public.journeys j on j.id = n.journey_id
    where i.id = journey_lessons.island_id and i.user_id = auth.uid() and j.user_id = auth.uid()
  ));

notify pgrst, 'reload schema';
