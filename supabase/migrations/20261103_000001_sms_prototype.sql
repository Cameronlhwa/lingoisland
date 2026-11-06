create table if not exists public.sms_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_number text not null unique check (phone_number ~ '^\+[1-9][0-9]{7,14}$'),
  display_name text not null default 'Learner',
  language_level text not null default 'beginner',
  persona text not null default 'Huahua',
  is_active boolean not null default true,
  opted_out boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.sms_contacts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  provider text not null,
  provider_message_id text not null,
  status text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique (provider, provider_message_id)
);

create table if not exists public.sms_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

create index if not exists sms_messages_contact_created_idx
  on public.sms_messages (contact_id, created_at desc);

alter table public.sms_contacts enable row level security;
alter table public.sms_messages enable row level security;
alter table public.sms_webhook_events enable row level security;

create policy "Users can view own SMS contacts"
  on public.sms_contacts for select using (auth.uid() = user_id);
create policy "Users can create own SMS contacts"
  on public.sms_contacts for insert with check (auth.uid() = user_id);
create policy "Users can update own SMS contacts"
  on public.sms_contacts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can view own SMS messages"
  on public.sms_messages for select using (auth.uid() = user_id);
create policy "Users can create own SMS messages"
  on public.sms_messages for insert with check (auth.uid() = user_id);
