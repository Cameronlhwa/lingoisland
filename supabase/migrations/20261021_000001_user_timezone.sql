-- Time zone used for the daily story calendar day.
alter table public.user_profiles
add column if not exists timezone text;

comment on column public.user_profiles.timezone is
'IANA time zone for the daily story date. Null follows the device clock.';
