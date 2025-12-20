-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- User profiles table
create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  cefr_level text not null default 'B1',
  created_at timestamptz not null default now()
);

-- Topic islands table
create table if not exists public.topic_islands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  level text not null default 'B1',
  word_target int not null default 12,
  grammar_target int not null default 0,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

-- Island words table
create table if not exists public.island_words (
  id uuid primary key default gen_random_uuid(),
  island_id uuid not null references topic_islands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  hanzi text not null,
  pinyin text not null,
  english text not null,
  difficulty_tag text not null default 'core',
  created_at timestamptz not null default now(),
  unique (island_id, hanzi)
);

-- Island sentences table
create table if not exists public.island_sentences (
  id uuid primary key default gen_random_uuid(),
  island_id uuid not null references topic_islands(id) on delete cascade,
  word_id uuid not null references island_words(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tier text not null,
  hanzi text not null,
  pinyin text not null,
  english text not null,
  grammar_tag text null,
  created_at timestamptz not null default now(),
  unique (word_id, tier)
);

-- Enable Row Level Security
alter table public.user_profiles enable row level security;
alter table public.topic_islands enable row level security;
alter table public.island_words enable row level security;
alter table public.island_sentences enable row level security;

-- RLS Policies for user_profiles
-- Users can select their own profile
drop policy if exists "Users can view their own profile" on public.user_profiles;
create policy "Users can view their own profile"
  on public.user_profiles
  for select
  using (auth.uid() = user_id);

-- Users can insert their own profile
drop policy if exists "Users can insert their own profile" on public.user_profiles;
create policy "Users can insert their own profile"
  on public.user_profiles
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own profile
drop policy if exists "Users can update their own profile" on public.user_profiles;
create policy "Users can update their own profile"
  on public.user_profiles
  for update
  using (auth.uid() = user_id);

-- RLS Policies for topic_islands
-- Users can select their own topic islands
drop policy if exists "Users can view their own topic islands" on public.topic_islands;
create policy "Users can view their own topic islands"
  on public.topic_islands
  for select
  using (auth.uid() = user_id);

-- Users can insert their own topic islands
drop policy if exists "Users can insert their own topic islands" on public.topic_islands;
create policy "Users can insert their own topic islands"
  on public.topic_islands
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own topic islands
drop policy if exists "Users can update their own topic islands" on public.topic_islands;
create policy "Users can update their own topic islands"
  on public.topic_islands
  for update
  using (auth.uid() = user_id);

-- Users can delete their own topic islands
drop policy if exists "Users can delete their own topic islands" on public.topic_islands;
create policy "Users can delete their own topic islands"
  on public.topic_islands
  for delete
  using (auth.uid() = user_id);

-- RLS Policies for island_words
drop policy if exists "Users can view their own island words" on public.island_words;
create policy "Users can view their own island words"
  on public.island_words
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own island words" on public.island_words;
create policy "Users can insert their own island words"
  on public.island_words
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own island words" on public.island_words;
create policy "Users can update their own island words"
  on public.island_words
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own island words" on public.island_words;
create policy "Users can delete their own island words"
  on public.island_words
  for delete
  using (auth.uid() = user_id);

-- RLS Policies for island_sentences
drop policy if exists "Users can view their own island sentences" on public.island_sentences;
create policy "Users can view their own island sentences"
  on public.island_sentences
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own island sentences" on public.island_sentences;
create policy "Users can insert their own island sentences"
  on public.island_sentences
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own island sentences" on public.island_sentences;
create policy "Users can update their own island sentences"
  on public.island_sentences
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own island sentences" on public.island_sentences;
create policy "Users can delete their own island sentences"
  on public.island_sentences
  for delete
  using (auth.uid() = user_id);

-- Indexes for performance
create index if not exists topic_islands_user_id_created_at_idx 
  on public.topic_islands(user_id, created_at desc);

create index if not exists island_words_user_id_island_id_created_at_idx
  on public.island_words(user_id, island_id, created_at);

create index if not exists island_sentences_user_id_island_id_created_at_idx
  on public.island_sentences(user_id, island_id, created_at);

-- Flashcard system tables

-- Folders table
create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- Decks table
create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid null references folders(id) on delete set null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, folder_id, name)
);

-- Flashcards table
create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references decks(id) on delete cascade,
  front text not null,
  back text not null,
  front_lang text not null default 'zh',
  back_lang text not null default 'en',
  pinyin text null,
  source text not null default 'manual',
  source_ref_id uuid null,
  created_at timestamptz not null default now()
);

-- Card review state (SRS)
create table if not exists public.card_review_state (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references flashcards(id) on delete cascade,
  ease float not null default 2.5,
  interval_days int not null default 1,
  due_at timestamptz not null default now(),
  last_reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (user_id, card_id)
);

-- Enable RLS for flashcard tables
alter table public.folders enable row level security;
alter table public.decks enable row level security;
alter table public.flashcards enable row level security;
alter table public.card_review_state enable row level security;

-- RLS Policies for folders
drop policy if exists "Users can view their own folders" on public.folders;
create policy "Users can view their own folders"
  on public.folders
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own folders" on public.folders;
create policy "Users can insert their own folders"
  on public.folders
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own folders" on public.folders;
create policy "Users can update their own folders"
  on public.folders
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own folders" on public.folders;
create policy "Users can delete their own folders"
  on public.folders
  for delete
  using (auth.uid() = user_id);

-- RLS Policies for decks
drop policy if exists "Users can view their own decks" on public.decks;
create policy "Users can view their own decks"
  on public.decks
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own decks" on public.decks;
create policy "Users can insert their own decks"
  on public.decks
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own decks" on public.decks;
create policy "Users can update their own decks"
  on public.decks
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own decks" on public.decks;
create policy "Users can delete their own decks"
  on public.decks
  for delete
  using (auth.uid() = user_id);

-- RLS Policies for flashcards
drop policy if exists "Users can view their own flashcards" on public.flashcards;
create policy "Users can view their own flashcards"
  on public.flashcards
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own flashcards" on public.flashcards;
create policy "Users can insert their own flashcards"
  on public.flashcards
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own flashcards" on public.flashcards;
create policy "Users can update their own flashcards"
  on public.flashcards
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own flashcards" on public.flashcards;
create policy "Users can delete their own flashcards"
  on public.flashcards
  for delete
  using (auth.uid() = user_id);

-- RLS Policies for card_review_state
drop policy if exists "Users can view their own card review state" on public.card_review_state;
create policy "Users can view their own card review state"
  on public.card_review_state
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own card review state" on public.card_review_state;
create policy "Users can insert their own card review state"
  on public.card_review_state
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own card review state" on public.card_review_state;
create policy "Users can update their own card review state"
  on public.card_review_state
  for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own card review state" on public.card_review_state;
create policy "Users can delete their own card review state"
  on public.card_review_state
  for delete
  using (auth.uid() = user_id);

-- Indexes for flashcard system
create index if not exists decks_user_id_folder_id_created_at_idx
  on public.decks(user_id, folder_id, created_at desc);

create index if not exists flashcards_user_id_deck_id_created_at_idx
  on public.flashcards(user_id, deck_id, created_at desc);

create index if not exists card_review_state_user_id_due_at_idx
  on public.card_review_state(user_id, due_at);

