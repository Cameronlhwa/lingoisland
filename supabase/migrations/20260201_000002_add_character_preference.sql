-- Add character_set preference to user_profiles table
-- Allows users to choose between Simplified and Traditional Chinese display

-- Add character_set column with default 'simplified' to maintain backward compatibility
alter table public.user_profiles
add column if not exists character_set text not null default 'simplified'
check (character_set in ('simplified', 'traditional'));

-- Add comment to document the column
comment on column public.user_profiles.character_set is 
'User preference for Chinese character display: simplified (简体字) or traditional (繁體字)';
