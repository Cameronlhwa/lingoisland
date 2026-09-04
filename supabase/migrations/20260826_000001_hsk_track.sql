-- HSK in-app track: user_profiles additions, content tables, SRS-reuse plumbing,
-- practice test scaffolding, and placeholder seed data.

-- 1. user_profiles additions
alter table user_profiles
  add column if not exists product_track text default 'core' check (product_track in ('core','hsk')),
  add column if not exists hsk_current_level int check (hsk_current_level between 1 and 6),
  add column if not exists hsk_level_source text check (hsk_level_source in ('official','placement_quiz','self_assessed')),
  add column if not exists hsk_target_level int check (hsk_target_level between 1 and 6),
  add column if not exists test_date date,
  add column if not exists hsk_motivation text check (hsk_motivation in ('study_abroad','career','heritage','personal')),
  add column if not exists hsk_flashcards_quiz_island_id uuid references quiz_islands(id);

-- 2. HSK vocabulary (reference content, not user-scoped)
create table if not exists public.hsk_words (
  id uuid primary key default gen_random_uuid(),
  level int not null check (level between 1 and 6),
  standard text not null default '2.0',
  hanzi text not null,
  pinyin text not null,
  english text not null,
  example_sentence text,
  example_pinyin text,
  audio_url text,
  is_placeholder boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists hsk_words_level_idx on public.hsk_words(level);

-- 3. Which HSK words a journey island teaches (populated by journey generation, empty for now)
create table if not exists public.journey_island_hsk_words (
  journey_island_id uuid references journey_islands(id) on delete cascade,
  hsk_word_id uuid references hsk_words(id) on delete cascade,
  primary key (journey_island_id, hsk_word_id)
);

-- 4. Practice test scaffolding (reference content + per-user attempts)
create table if not exists public.practice_tests (
  id uuid primary key default gen_random_uuid(),
  level int not null check (level between 1 and 6),
  standard text not null default '2.0',
  title text not null,
  is_free boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.test_sections (
  id uuid primary key default gen_random_uuid(),
  test_id uuid references practice_tests(id) on delete cascade,
  type text not null check (type in ('listening','reading','writing')),
  question_count int not null,
  time_limit_minutes int not null
);

create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  test_id uuid references practice_tests(id),
  section_scores jsonb,
  total_score int,
  percent numeric,
  completed_at timestamptz default now(),
  is_placeholder boolean not null default false
);
create index if not exists test_attempts_user_test_idx on public.test_attempts(user_id, test_id, completed_at desc);

-- 5. RLS
alter table public.hsk_words enable row level security;
drop policy if exists "authenticated can read hsk_words" on public.hsk_words;
create policy "authenticated can read hsk_words"
  on public.hsk_words for select to authenticated using (true);

alter table public.journey_island_hsk_words enable row level security;
drop policy if exists "authenticated can read journey_island_hsk_words" on public.journey_island_hsk_words;
create policy "authenticated can read journey_island_hsk_words"
  on public.journey_island_hsk_words for select to authenticated using (true);

alter table public.practice_tests enable row level security;
drop policy if exists "authenticated can read practice_tests" on public.practice_tests;
create policy "authenticated can read practice_tests"
  on public.practice_tests for select to authenticated using (true);

alter table public.test_sections enable row level security;
drop policy if exists "authenticated can read test_sections" on public.test_sections;
create policy "authenticated can read test_sections"
  on public.test_sections for select to authenticated using (true);

alter table public.test_attempts enable row level security;
drop policy if exists "users manage own test_attempts" on public.test_attempts;
create policy "users manage own test_attempts"
  on public.test_attempts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. Aggregate progress RPC — mirrors get_quiz_queue/grade_card's security-definer +
-- auth.uid() pattern. Status precedence: due > mastered > learning > not_introduced.
create or replace function public.get_hsk_level_progress(p_level int)
returns table(total bigint, mastered bigint, due bigint, learning bigint)
language sql security definer as $$
  select
    count(*) as total,
    count(*) filter (
      where crs.mastery_tier = 'easy'
        and (crs.due_at is null or crs.due_at > now())
    ) as mastered,
    count(*) filter (where crs.due_at is not null and crs.due_at <= now()) as due,
    count(*) filter (
      where c.id is not null
        and not (crs.mastery_tier = 'easy' and (crs.due_at is null or crs.due_at > now()))
        and not (crs.due_at is not null and crs.due_at <= now())
    ) as learning
  from public.hsk_words hw
  left join public.cards c
    on c.source_type = 'hsk_word' and c.source_ref_id = hw.id and c.user_id = auth.uid()
  left join public.card_review_state crs
    on crs.card_id = c.id and crs.user_id = auth.uid()
  where hw.level = p_level;
$$;

-- 7. Placeholder seed data — clearly marked, meant to be replaced by real HSK 2.0/3.0
-- content lists (a separate content-sourcing decision) before this ships to real users.
-- TODO: replace with real official HSK vocabulary once standard (2.0 vs 3.0) is confirmed.
insert into public.hsk_words (level, standard, hanzi, pinyin, english, example_sentence, example_pinyin, is_placeholder)
select
  lvl,
  '2.0',
  '占位' || lvl || '-' || n,
  'zhànwèi ' || lvl || '-' || n,
  'Placeholder word ' || n || ' (HSK ' || lvl || ')',
  '这是占位' || lvl || '-' || n || '的例句。',
  'Zhè shì zhànwèi ' || lvl || '-' || n || ' de lìjù.',
  true
from generate_series(1, 6) as lvl
cross join generate_series(1, 18) as n;

-- TODO: replace with real listening/reading/writing content once sourced.
insert into public.practice_tests (level, standard, title, is_free)
select
  lvl,
  '2.0',
  'HSK ' || lvl || ' Practice Test ' || n,
  (n = 1)
from generate_series(1, 6) as lvl
cross join generate_series(1, 2) as n;

insert into public.test_sections (test_id, type, question_count, time_limit_minutes)
select pt.id, sec.type, sec.question_count, sec.time_limit_minutes
from public.practice_tests pt
cross join (
  values
    ('listening', 20, 15),
    ('reading', 20, 20),
    ('writing', 10, 15)
) as sec(type, question_count, time_limit_minutes);
