create table if not exists public.onboarding_email_captures (
  email text primary key,
  topic text,
  captured_at timestamptz default now()
);

alter table public.onboarding_email_captures enable row level security;

-- Allow inserts from the app (including anonymous sessions). No public reads or updates.
drop policy if exists "Allow insert onboarding email captures" on public.onboarding_email_captures;
create policy "Allow insert onboarding email captures"
  on public.onboarding_email_captures
  for insert
  with check (true);

drop policy if exists "Allow update onboarding email captures" on public.onboarding_email_captures;
