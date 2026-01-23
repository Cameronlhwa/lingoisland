-- Track quiz activity events for calendar usage
create table if not exists public.quiz_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references cards(id) on delete cascade,
  reviewed_at timestamptz not null default now()
);

create index if not exists quiz_activity_events_user_date_idx
  on public.quiz_activity_events(user_id, reviewed_at desc);

alter table public.quiz_activity_events enable row level security;

drop policy if exists "Users can view their own quiz activity events"
  on public.quiz_activity_events;
create policy "Users can view their own quiz activity events"
  on public.quiz_activity_events for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own quiz activity events"
  on public.quiz_activity_events;
create policy "Users can insert their own quiz activity events"
  on public.quiz_activity_events for insert
  with check (auth.uid() = user_id);

