alter table public.user_profiles
  add column if not exists huahua_stage integer default 1 check (huahua_stage between 1 and 5),
  add column if not exists huahua_total_reviews integer default 0;
