-- OPTIONAL reference tables for A0 course content.
-- Runtime source of truth is lib/a0Course.ts (in-code constants) so A0
-- onboarding works without this migration and without DeepSeek.
-- These tables are not read by the app; kept for optional ops/admin use.

create table if not exists public.a0_course_words (
  id uuid primary key default gen_random_uuid(),
  word_order int not null unique,
  hanzi text not null,
  pinyin text not null,
  english text not null
);

create table if not exists public.a0_course_sentences (
  id uuid primary key default gen_random_uuid(),
  sentence_order int not null unique,
  zh text not null,
  pinyin text not null,
  english text not null
);

alter table public.a0_course_words enable row level security;
alter table public.a0_course_sentences enable row level security;

-- Public read: onboarding may run as anonymous; content is not user-specific.
drop policy if exists "Anyone can read a0_course_words" on public.a0_course_words;
create policy "Anyone can read a0_course_words"
  on public.a0_course_words
  for select
  using (true);

drop policy if exists "Anyone can read a0_course_sentences" on public.a0_course_sentences;
create policy "Anyone can read a0_course_sentences"
  on public.a0_course_sentences
  for select
  using (true);

insert into public.a0_course_words (word_order, hanzi, pinyin, english) values
  (1, '你好', 'nǐ hǎo', 'hello'),
  (2, '我', 'wǒ', 'I, me'),
  (3, '叫', 'jiào', 'to be called'),
  (4, '什么', 'shénme', 'what'),
  (5, '名字', 'míngzi', 'name')
on conflict (word_order) do nothing;

insert into public.a0_course_sentences (sentence_order, zh, pinyin, english) values
  (1, '你好!', 'Nǐ hǎo!', 'Hello!'),
  (2, '我叫[Name]。', 'Wǒ jiào [Name].', 'My name is [Name].'),
  (3, '你叫什么名字?', 'Nǐ jiào shénme míngzi?', 'What''s your name?')
on conflict (sentence_order) do nothing;
