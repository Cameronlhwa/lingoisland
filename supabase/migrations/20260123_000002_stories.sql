-- Stories table for daily/custom generated stories
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('daily', 'custom')),
  date date null,
  title text not null,
  level text not null,
  length_chars int not null,
  topic text null,
  story_zh text not null,
  story_en text null,
  story_pinyin text null,
  source_island_ids uuid[] not null default '{}',
  target_word_ids uuid[] not null default '{}',
  requested_words text[] not null default '{}',
  created_at timestamptz not null default now()
);

create unique index if not exists stories_user_daily_unique
  on public.stories(user_id, kind, date)
  where kind = 'daily' and date is not null;

alter table public.stories enable row level security;

drop policy if exists "Users can view their own stories" on public.stories;
create policy "Users can view their own stories"
  on public.stories
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own stories" on public.stories;
create policy "Users can insert their own stories"
  on public.stories
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own stories" on public.stories;
create policy "Users can update their own stories"
  on public.stories
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own stories" on public.stories;
create policy "Users can delete their own stories"
  on public.stories
  for delete
  using (auth.uid() = user_id);

