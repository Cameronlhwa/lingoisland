-- HSK pre-payment onboarding: pacing + personalization columns, and a remap of
-- hsk_motivation from its original 4-way enum (study_abroad/career/heritage/personal,
-- collected post-payment) to the new pre-payment bucket set (school/job/heritage/hobby).

alter table user_profiles
  add column if not exists daily_time_minutes int,
  add column if not exists hsk_personalization_text text;

-- Remap existing hsk_motivation values before tightening the constraint, so no
-- row is left violating the new check.
alter table user_profiles
  drop constraint if exists user_profiles_hsk_motivation_check;

update user_profiles
set hsk_motivation = case hsk_motivation
  when 'study_abroad' then 'school'
  when 'career' then 'job'
  when 'personal' then 'hobby'
  else hsk_motivation -- 'heritage' is unchanged; null stays null
end
where hsk_motivation is not null;

alter table user_profiles
  add constraint user_profiles_hsk_motivation_check
    check (hsk_motivation in ('school','job','heritage','hobby'));
