alter table public.topic_islands
  add column if not exists sentence_style text not null default 'casual'
  check (sentence_style in ('casual', 'professional'));

alter table public.journeys
  add column if not exists sentence_style text not null default 'casual'
  check (sentence_style in ('casual', 'professional'));

comment on column public.topic_islands.sentence_style is 'Example sentence register: casual (everyday) or professional (workplace).';
comment on column public.journeys.sentence_style is 'Preferred example sentence register for islands started from this journey.';
