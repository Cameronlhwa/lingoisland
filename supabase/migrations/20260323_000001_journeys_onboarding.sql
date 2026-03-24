-- Journeys (personalised learning paths)
create table if not exists public.journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  why text,
  time_label text,
  days_per_week int,
  words_per_week int,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.journey_islands (
  id uuid primary key default gen_random_uuid(),
  journey_id uuid not null references public.journeys(id) on delete cascade,
  "order" int not null,
  name text not null,
  zh text,
  story_idea text,
  island_id uuid references public.topic_islands(id) on delete set null,
  completed_at timestamptz,
  unique (journey_id, "order")
);

create index if not exists journeys_user_id_idx on public.journeys (user_id);
create index if not exists journey_islands_journey_id_idx on public.journey_islands (journey_id);
create index if not exists journey_islands_island_id_idx on public.journey_islands (island_id);

alter table public.profiles
  add column if not exists onboarding_complete boolean not null default false;

alter table public.profiles
  add column if not exists active_journey_id uuid references public.journeys(id) on delete set null;

alter table public.journeys enable row level security;
alter table public.journey_islands enable row level security;

drop policy if exists "Users manage own journeys" on public.journeys;
create policy "Users manage own journeys"
  on public.journeys for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own journey_islands" on public.journey_islands;
create policy "Users manage own journey_islands"
  on public.journey_islands for all
  using (
    exists (
      select 1 from public.journeys j
      where j.id = journey_islands.journey_id and j.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.journeys j
      where j.id = journey_islands.journey_id and j.user_id = auth.uid()
    )
  );
