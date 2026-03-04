-- Track topic-island in-page flashcard reviews for Progress Island (no card_id; counts as one review per flip)
create table if not exists public.topic_island_review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reviewed_at timestamptz not null default now()
);

create index if not exists topic_island_review_events_user_date_idx
  on public.topic_island_review_events(user_id, reviewed_at desc);

alter table public.topic_island_review_events enable row level security;

drop policy if exists "Users can view their own topic island review events"
  on public.topic_island_review_events;
create policy "Users can view their own topic island review events"
  on public.topic_island_review_events for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own topic island review events"
  on public.topic_island_review_events;
create policy "Users can insert their own topic island review events"
  on public.topic_island_review_events for insert
  with check (auth.uid() = user_id);
