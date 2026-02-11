-- Progressive onboarding nudge state (first-time experience only)
create table if not exists public.user_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  onboarding_started_at timestamptz,
  onboarding_ends_at timestamptz,
  onboarding_disabled boolean not null default false,
  steps_completed jsonb not null default '[]',
  steps_dismissed jsonb not null default '[]',
  last_nudge_shown_at timestamptz,
  entry_source text check (entry_source in ('topic_island', 'story', 'unknown')),
  updated_at timestamptz not null default now()
);

comment on table public.user_onboarding is 'First-time onboarding nudge state. Nudges only when now() < onboarding_ends_at and not disabled.';

alter table public.user_onboarding enable row level security;

drop policy if exists "Users can view own onboarding" on public.user_onboarding;
create policy "Users can view own onboarding"
  on public.user_onboarding for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own onboarding" on public.user_onboarding;
create policy "Users can insert own onboarding"
  on public.user_onboarding for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own onboarding" on public.user_onboarding;
create policy "Users can update own onboarding"
  on public.user_onboarding for update
  using (auth.uid() = user_id);
