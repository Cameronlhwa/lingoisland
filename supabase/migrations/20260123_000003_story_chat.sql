-- Story chat threads/messages
create table if not exists public.story_chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, story_id)
);

create table if not exists public.story_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.story_chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  model text null,
  created_at timestamptz not null default now()
);

alter table public.story_chat_threads enable row level security;
alter table public.story_chat_messages enable row level security;

drop policy if exists "Users can view their own story chat threads" on public.story_chat_threads;
create policy "Users can view their own story chat threads"
  on public.story_chat_threads
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own story chat threads" on public.story_chat_threads;
create policy "Users can insert their own story chat threads"
  on public.story_chat_threads
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own story chat threads" on public.story_chat_threads;
create policy "Users can update their own story chat threads"
  on public.story_chat_threads
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own story chat threads" on public.story_chat_threads;
create policy "Users can delete their own story chat threads"
  on public.story_chat_threads
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can view their own story chat messages" on public.story_chat_messages;
create policy "Users can view their own story chat messages"
  on public.story_chat_messages
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own story chat messages" on public.story_chat_messages;
create policy "Users can insert their own story chat messages"
  on public.story_chat_messages
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own story chat messages" on public.story_chat_messages;
create policy "Users can update their own story chat messages"
  on public.story_chat_messages
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own story chat messages" on public.story_chat_messages;
create policy "Users can delete their own story chat messages"
  on public.story_chat_messages
  for delete
  using (auth.uid() = user_id);

