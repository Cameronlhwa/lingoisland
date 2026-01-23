alter table public.stories
  add column if not exists saved boolean not null default false;

-- Backfill existing stories so they remain visible
update public.stories
  set saved = true
  where saved = false;

