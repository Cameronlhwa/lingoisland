create table if not exists public.cancellation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_at_time text not null,
  reason text not null,
  details text null,
  comeback text null,
  created_at timestamptz not null default now()
);

alter table public.cancellation_feedback enable row level security;

drop policy if exists "Users can insert their own cancellation feedback"
  on public.cancellation_feedback;
create policy "Users can insert their own cancellation feedback"
  on public.cancellation_feedback
  for insert
  with check (auth.uid() = user_id);
