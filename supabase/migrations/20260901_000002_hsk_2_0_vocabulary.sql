-- HSK 2.0 vocabulary sits alongside 3.0 in hsk_words (standard = '2.0').
-- Persist which syllabus the user is preparing for, and count progress per standard.

alter table public.user_profiles
  add column if not exists hsk_standard text not null default '3.0';

alter table public.user_profiles
  drop constraint if exists user_profiles_hsk_standard_check;

alter table public.user_profiles
  add constraint user_profiles_hsk_standard_check
    check (hsk_standard in ('2.0', '3.0'));

comment on column public.user_profiles.hsk_standard is
  'HSK syllabus to study: legacy 2.0 (levels 1-6) or 3.0 (levels 1-9).';

create index if not exists hsk_words_standard_level_idx
  on public.hsk_words(standard, level, sort_order)
  where is_placeholder = false;

drop function if exists public.get_hsk_level_progress(int);
drop function if exists public.get_hsk_level_progress(int, text);

create or replace function public.get_hsk_level_progress(
  p_level int,
  p_standard text default '3.0'
)
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
    and hw.standard = p_standard
    and hw.is_placeholder = false;
$$;
