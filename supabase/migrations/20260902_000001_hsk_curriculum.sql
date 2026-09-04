-- HSK curriculum ("My HSK Path"): an ordered list of themed Units that carry a
-- learner from their current HSK level to their target level. Each Unit is a
-- normal `journeys` row (5 islands + 2 stories); ~70% of a Unit's ~45 words are
-- not-yet-learned official HSK words (tagged via journey_island_hsk_words), the
-- rest are supporting/filler vocab. Only Unit 1 is built at creation; the rest
-- are "sketches" (title + theme + interest) until the learner reaches them.

-- 1. Curricula — one active curriculum per user
create table if not exists public.curricula (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  hsk_standard            text not null default '3.0' check (hsk_standard in ('2.0', '3.0')),
  start_level             int not null check (start_level between 1 and 7),
  target_level            int not null check (target_level between 1 and 7),
  current_milestone_level int not null check (current_milestone_level between 1 and 7),
  status                  text not null default 'active' check (status in ('active', 'completed')),
  created_at              timestamptz not null default now(),
  completed_at            timestamptz
);

-- One active curriculum per user; historical/completed ones are allowed to pile up.
create unique index if not exists curricula_one_active_per_user
  on public.curricula (user_id)
  where status = 'active';

create index if not exists curricula_user_id_idx on public.curricula (user_id);

-- 2. Curriculum units — the ordered "Unit 1", "Unit 2", ... entries
create table if not exists public.curriculum_units (
  id              uuid primary key default gen_random_uuid(),
  curriculum_id   uuid not null references public.curricula(id) on delete cascade,
  unit_number     int not null,
  milestone_level int not null check (milestone_level between 1 and 7),
  title           text not null,
  title_zh        text,
  theme           text,
  interest_tag    text,
  status          text not null default 'sketch'
                    check (status in ('sketch', 'building', 'ready', 'completed')),
  journey_id      uuid references public.journeys(id) on delete set null,
  hsk_word_ids    uuid[] not null default '{}',
  created_at      timestamptz not null default now(),
  completed_at    timestamptz,
  unique (curriculum_id, unit_number)
);

create index if not exists curriculum_units_curriculum_id_idx
  on public.curriculum_units (curriculum_id, unit_number);
create index if not exists curriculum_units_journey_id_idx
  on public.curriculum_units (journey_id);

-- 3. Pointers / personalization on user_profiles
alter table public.user_profiles
  add column if not exists interests text[] not null default '{}',
  add column if not exists active_curriculum_id uuid references public.curricula(id) on delete set null;

-- Journey code (and the plan-reveal) already treats level 7 as the "HSK 7-9"
-- band; loosen the current/target checks from the original hsk_track migration.
alter table public.user_profiles
  drop constraint if exists user_profiles_hsk_current_level_check;
alter table public.user_profiles
  add constraint user_profiles_hsk_current_level_check
    check (hsk_current_level is null or hsk_current_level between 1 and 7);
alter table public.user_profiles
  drop constraint if exists user_profiles_hsk_target_level_check;
alter table public.user_profiles
  add constraint user_profiles_hsk_target_level_check
    check (hsk_target_level is null or hsk_target_level between 1 and 7);

-- 4. Reverse lookup from a built Unit's journey back to its curriculum unit
alter table public.journeys
  add column if not exists curriculum_unit_id uuid references public.curriculum_units(id) on delete set null;

-- 5. Per-island word plan for a curriculum unit. Populated when the Unit is
--    built; consumed by /api/journey/[id]/start-island, which seeds these into
--    island_words and then generates only sentences (no fresh word list).
--    Shape: [{ "hanzi": "爱", "pinyin": "ài", "english": "to love",
--             "hsk_word_id": "<uuid|null>", "hsk_level": 4|null }]
alter table public.journey_islands
  add column if not exists seed_words jsonb;

-- 6. Per-word HSK level on seeded island words, so the learn/quiz UI can badge
--    "HSK N" without a join through journey_island_hsk_words.
alter table public.island_words
  add column if not exists hsk_level int check (hsk_level is null or hsk_level between 1 and 7);

-- 6. RLS
alter table public.curricula enable row level security;
drop policy if exists "Users manage own curricula" on public.curricula;
create policy "Users manage own curricula"
  on public.curricula for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.curriculum_units enable row level security;
drop policy if exists "Users manage own curriculum_units" on public.curriculum_units;
create policy "Users manage own curriculum_units"
  on public.curriculum_units for all
  using (
    exists (
      select 1 from public.curricula c
      where c.id = curriculum_units.curriculum_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.curricula c
      where c.id = curriculum_units.curriculum_id and c.user_id = auth.uid()
    )
  );

-- journey_island_hsk_words shipped with only a SELECT policy, so tagging a
-- journey island's HSK words from a user-context request (curriculum unit build
-- and the legacy HSK journey generator) was silently blocked by RLS. Allow the
-- owner of the parent journey to insert/delete tags.
drop policy if exists "Users write own journey_island_hsk_words" on public.journey_island_hsk_words;
create policy "Users write own journey_island_hsk_words"
  on public.journey_island_hsk_words for all to authenticated
  using (
    exists (
      select 1
      from public.journey_islands ji
      join public.journeys j on j.id = ji.journey_id
      where ji.id = journey_island_hsk_words.journey_island_id
        and j.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.journey_islands ji
      join public.journeys j on j.id = ji.journey_id
      where ji.id = journey_island_hsk_words.journey_island_id
        and j.user_id = auth.uid()
    )
  );
