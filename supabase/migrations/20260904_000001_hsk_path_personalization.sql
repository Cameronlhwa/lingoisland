-- HSK Path personalization: word interest/functional tags, placement decoys,
-- and a simplified hsk_level_source enum (official | checklist).

alter table public.hsk_words
  add column if not exists interest_tags text[] not null default '{}',
  add column if not exists is_functional boolean not null default false;

create index if not exists hsk_words_interest_tags_idx
  on public.hsk_words using gin (interest_tags);

create index if not exists hsk_words_functional_idx
  on public.hsk_words (standard, level)
  where is_functional = true and is_placeholder = false;

create table if not exists public.hsk_placement_decoys (
  id uuid primary key default gen_random_uuid(),
  hanzi text not null,
  pinyin text not null,
  difficulty_level int not null check (difficulty_level between 1 and 6),
  created_at timestamptz not null default now()
);

create unique index if not exists hsk_placement_decoys_hanzi_uidx
  on public.hsk_placement_decoys (hanzi);

alter table public.hsk_placement_decoys enable row level security;
drop policy if exists "authenticated can read hsk_placement_decoys" on public.hsk_placement_decoys;
create policy "authenticated can read hsk_placement_decoys"
  on public.hsk_placement_decoys for select to authenticated using (true);

-- Hand-checked starter decoys (not in HSK 2.0). The tagging script can add more.
insert into public.hsk_placement_decoys (hanzi, pinyin, difficulty_level)
values
  ('天口', 'tiānkǒu', 1),
  ('木飞', 'mùfēi', 1),
  ('日飞', 'rìfēi', 1),
  ('土风', 'tǔfēng', 1),
  ('石天', 'shítiān', 1),
  ('月走', 'yuèzǒu', 2),
  ('青木屋', 'qīngmùwū', 2),
  ('白日行', 'báirìxíng', 2),
  ('河上鸟', 'héshàngniǎo', 2),
  ('风中茶', 'fēngzhōngchá', 2),
  ('山外云', 'shānwàiyún', 3),
  ('灯下人', 'dēngxiàrén', 3),
  ('空中鱼', 'kōngzhōngyú', 3),
  ('纸上花', 'zhǐshànghuā', 3),
  ('雨前风', 'yǔqiánfēng', 3),
  ('门后月', 'ménhòuyuè', 4),
  ('星下路', 'xīngxiàlù', 4),
  ('海中灯', 'hǎizhōngdēng', 4),
  ('城外雪', 'chéngwàixuě', 4),
  ('林间火', 'línjiānhuǒ', 4),
  ('书中雨', 'shūzhōngyǔ', 5),
  ('窗前竹', 'chuāngqiánzhú', 5),
  ('江上月', 'jiāngshàngyuè', 5),
  ('谷中风', 'gǔzhōngfēng', 5),
  ('桥下影', 'qiáoxiàyǐng', 5),
  ('夜半灯', 'yèbàndēng', 6),
  ('远山客', 'yuǎnshānkè', 6),
  ('寒江雪', 'hánjiāngxuě', 6),
  ('春风客', 'chūnfēngkè', 6),
  ('秋水人', 'qiūshuǐrén', 6)
on conflict (hanzi) do nothing;

-- Wipe leftover placement_quiz / self_assessed values before tightening the check.
-- (Part 0 is a full HSK-path reset; this is a safety net if that hasn't run yet.)
update public.user_profiles
set hsk_level_source = null
where hsk_level_source in ('placement_quiz', 'self_assessed');

alter table public.user_profiles
  drop constraint if exists user_profiles_hsk_level_source_check;
alter table public.user_profiles
  add constraint user_profiles_hsk_level_source_check
    check (hsk_level_source is null or hsk_level_source in ('official', 'checklist'));
