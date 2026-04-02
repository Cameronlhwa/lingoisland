-- Add English title field to stories so the daily story card can show a translated title.
alter table public.stories
  add column if not exists title_en text;
