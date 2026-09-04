-- New HSK 3.0 vocabulary storage + efficient word-bank indexes.

create extension if not exists pg_trgm;

alter table public.hsk_words
  drop constraint if exists hsk_words_level_check;

alter table public.hsk_words
  add column if not exists part_of_speech text,
  add column if not exists sort_order int,
  add column if not exists level_band text;

alter table public.hsk_words
  alter column english drop not null,
  alter column standard set default '3.0';

alter table public.hsk_words
  add constraint hsk_words_level_check check (level between 1 and 9);

create index if not exists hsk_words_level_sort_idx
  on public.hsk_words(level, sort_order);

create index if not exists hsk_words_level_band_idx
  on public.hsk_words(level_band)
  where level_band is not null;

create index if not exists hsk_words_hanzi_trgm_idx
  on public.hsk_words using gin (hanzi gin_trgm_ops);

create index if not exists hsk_words_pinyin_trgm_idx
  on public.hsk_words using gin (pinyin gin_trgm_ops);

create index if not exists hsk_words_english_trgm_idx
  on public.hsk_words using gin (english gin_trgm_ops);

create unique index if not exists hsk_words_standard_level_order_uidx
  on public.hsk_words(standard, level, sort_order)
  where is_placeholder = false;

-- Remove placeholder seed rows from the initial HSK track migration.
delete from public.hsk_words where is_placeholder = true;

-- Progress RPC: support level 7 (HSK 7-9 band) and official sort order.
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
  where hw.level = p_level
    and hw.is_placeholder = false;
$$;
