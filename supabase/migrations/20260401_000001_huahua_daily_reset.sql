-- Add daily-reset columns for 华华 island progress.
-- huahua_reviews_today resets to 0 each calendar day (UTC).
-- huahua_last_review_date records the UTC date string (YYYY-MM-DD) of the last increment.
alter table public.user_profiles
  add column if not exists huahua_reviews_today  integer not null default 0,
  add column if not exists huahua_last_review_date text; -- 'YYYY-MM-DD' UTC
