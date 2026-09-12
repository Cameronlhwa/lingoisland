-- Pronunciation Practice feature: profiles, sessions, attempts, diagnostic attempts,
-- API usage rate-limiting, and a new 'tone_practice' journey node type.

-- ── Prerequisite bugfix ──────────────────────────────────────────────────────
-- app/api/journey/[id]/route.ts previously re-derived node_type/position from
-- step_order ranges instead of trusting the stored columns. That derivation has
-- no bucket for a third node type, so this fixes the underlying rows first.
-- Any legacy story rows that were never backfilled get node_type/position fixed
-- here; everything else (the vast majority, populated correctly since
-- 20260326_000001_journey_nodes.sql) is left untouched.
update public.journey_islands
set node_type = 'story'
where node_type = 'island' and step_order in (102, 105);

update public.journey_islands
set position = case
  when step_order = 102 then 3
  when step_order = 105 then 7
  else position
end
where node_type = 'story' and (position is null or position >= 100);

-- ── journey_islands: add the new node type ──────────────────────────────────
alter table public.journey_islands
  drop constraint if exists journey_islands_node_type_check;

alter table public.journey_islands
  add constraint journey_islands_node_type_check
  check (node_type in ('island', 'story', 'tone_practice'));

-- ── pronunciation_profiles ───────────────────────────────────────────────────
-- One row per user: Flow 0.5's rolling pronunciation profile plus Flow 1's
-- placement/preferences.
create table if not exists public.pronunciation_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  overall_score numeric,
  weak_sounds jsonb not null default '[]'::jsonb,
  hsk_level text,
  topics text[] not null default '{}',
  custom_topic text,
  daily_minutes int,
  onboarded_at timestamptz,
  diagnostic_completed_at timestamptz,
  last_practiced_at timestamptz,
  streak_count int not null default 0,
  streak_last_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── pronunciation_sessions ───────────────────────────────────────────────────
-- One row per Flow 2 sitting, either bound to a journey's tone_practice node
-- or a standalone practice session.
create table if not exists public.pronunciation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  journey_island_id uuid references public.journey_islands(id) on delete set null,
  source text not null default 'standalone' check (source in ('journey_node', 'standalone')),
  sentences jsonb not null default '[]'::jsonb,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists pronunciation_sessions_user_id_idx
  on public.pronunciation_sessions (user_id);
create index if not exists pronunciation_sessions_journey_island_id_idx
  on public.pronunciation_sessions (journey_island_id);

-- Now that pronunciation_sessions exists, journey_islands can reference it —
-- mirrors the lazy-create-on-first-open story_id/island_id pattern.
alter table public.journey_islands
  add column if not exists pronunciation_session_id uuid
  references public.pronunciation_sessions(id) on delete set null;

-- ── pronunciation_attempts ───────────────────────────────────────────────────
-- Every recording+score in the Flow 2 daily loop (word, sentence, or an
-- isolated syllable drill). Feeds Flow 3's "still struggling" trigger and
-- Flow 4's aggregates.
create table if not exists public.pronunciation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.pronunciation_sessions(id) on delete cascade,
  journey_island_id uuid references public.journey_islands(id) on delete set null,
  unit_type text not null check (unit_type in ('word', 'sentence', 'syllable_drill')),
  target_text text not null,
  target_pinyin text,
  island_word_id uuid references public.island_words(id) on delete set null,
  attempt_number int not null default 1,
  score jsonb,
  overall_score numeric,
  weak_syllables jsonb not null default '[]'::jsonb,
  client_request_id uuid,
  created_at timestamptz not null default now(),
  unique (session_id, target_text, client_request_id)
);

create index if not exists pronunciation_attempts_user_id_idx
  on public.pronunciation_attempts (user_id);
create index if not exists pronunciation_attempts_session_id_idx
  on public.pronunciation_attempts (session_id);

-- ── pronunciation_diagnostic_attempts ────────────────────────────────────────
-- Flow 0's 10-sentence pass (pass_label='day1') and Flow 4's re-measure
-- (pass_label='remeasure').
create table if not exists public.pronunciation_diagnostic_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pass_label text not null default 'day1' check (pass_label in ('day1', 'remeasure')),
  item_index int not null,
  reference_text text not null,
  target_tags text[] not null default '{}',
  audio_path text,
  score jsonb,
  overall_score numeric,
  created_at timestamptz not null default now(),
  unique (user_id, pass_label, item_index)
);

create index if not exists pronunciation_diagnostic_attempts_user_id_idx
  on public.pronunciation_diagnostic_attempts (user_id, pass_label);

-- ── pronunciation_api_usage ──────────────────────────────────────────────────
-- Per-user, per-day counter used to rate-limit paid SpeechSuper calls.
create table if not exists public.pronunciation_api_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default current_date,
  call_count int not null default 0,
  primary key (user_id, usage_date)
);

-- Atomic per-user daily usage increment, used to rate-limit paid SpeechSuper
-- calls without a read-then-write race. security definer is safe here because
-- the function only ever touches the row for p_user_id, and callers always
-- pass the authenticated caller's own auth.uid() — never client-supplied input.
create or replace function public.increment_pronunciation_usage(p_user_id uuid)
returns int
language sql
security definer
set search_path = public
as $$
  insert into public.pronunciation_api_usage (user_id, usage_date, call_count)
  values (p_user_id, current_date, 1)
  on conflict (user_id, usage_date)
  do update set call_count = pronunciation_api_usage.call_count + 1
  returning call_count;
$$;

revoke all on function public.increment_pronunciation_usage(uuid) from public;
grant execute on function public.increment_pronunciation_usage(uuid) to authenticated;

-- ── Row Level Security ───────────────────────────────────────────────────────
alter table public.pronunciation_profiles enable row level security;
alter table public.pronunciation_sessions enable row level security;
alter table public.pronunciation_attempts enable row level security;
alter table public.pronunciation_diagnostic_attempts enable row level security;
alter table public.pronunciation_api_usage enable row level security;

-- pronunciation_profiles
drop policy if exists "Users can view their own pronunciation profile" on public.pronunciation_profiles;
create policy "Users can view their own pronunciation profile"
  on public.pronunciation_profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own pronunciation profile" on public.pronunciation_profiles;
create policy "Users can insert their own pronunciation profile"
  on public.pronunciation_profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own pronunciation profile" on public.pronunciation_profiles;
create policy "Users can update their own pronunciation profile"
  on public.pronunciation_profiles
  for update
  using (auth.uid() = user_id);

-- pronunciation_sessions
drop policy if exists "Users can view their own pronunciation sessions" on public.pronunciation_sessions;
create policy "Users can view their own pronunciation sessions"
  on public.pronunciation_sessions
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own pronunciation sessions" on public.pronunciation_sessions;
create policy "Users can insert their own pronunciation sessions"
  on public.pronunciation_sessions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own pronunciation sessions" on public.pronunciation_sessions;
create policy "Users can update their own pronunciation sessions"
  on public.pronunciation_sessions
  for update
  using (auth.uid() = user_id);

-- pronunciation_attempts
drop policy if exists "Users can view their own pronunciation attempts" on public.pronunciation_attempts;
create policy "Users can view their own pronunciation attempts"
  on public.pronunciation_attempts
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own pronunciation attempts" on public.pronunciation_attempts;
create policy "Users can insert their own pronunciation attempts"
  on public.pronunciation_attempts
  for insert
  with check (auth.uid() = user_id);

-- pronunciation_diagnostic_attempts
drop policy if exists "Users can view their own diagnostic attempts" on public.pronunciation_diagnostic_attempts;
create policy "Users can view their own diagnostic attempts"
  on public.pronunciation_diagnostic_attempts
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own diagnostic attempts" on public.pronunciation_diagnostic_attempts;
create policy "Users can insert their own diagnostic attempts"
  on public.pronunciation_diagnostic_attempts
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own diagnostic attempts" on public.pronunciation_diagnostic_attempts;
create policy "Users can update their own diagnostic attempts"
  on public.pronunciation_diagnostic_attempts
  for update
  using (auth.uid() = user_id);

-- pronunciation_api_usage
drop policy if exists "Users can view their own api usage" on public.pronunciation_api_usage;
create policy "Users can view their own api usage"
  on public.pronunciation_api_usage
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own api usage" on public.pronunciation_api_usage;
create policy "Users can insert their own api usage"
  on public.pronunciation_api_usage
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own api usage" on public.pronunciation_api_usage;
create policy "Users can update their own api usage"
  on public.pronunciation_api_usage
  for update
  using (auth.uid() = user_id);

-- ── Private storage bucket for diagnostic recordings (Flow 0 / Flow 4 only) ──
-- Flow 2's daily-drill audio is scored and discarded; it never reaches Storage.
insert into storage.buckets (id, name, public)
values ('pronunciation-recordings', 'pronunciation-recordings', false)
on conflict (id) do nothing;

drop policy if exists "Users manage own pronunciation recordings" on storage.objects;
create policy "Users manage own pronunciation recordings"
  on storage.objects
  for all
  using (bucket_id = 'pronunciation-recordings' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'pronunciation-recordings' and (storage.foldername(name))[1] = auth.uid()::text);
