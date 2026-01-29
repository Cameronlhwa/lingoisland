-- Add TTS rate settings to user_profiles table
-- These control the speaking speed for Google Cloud Text-to-Speech

alter table public.user_profiles
  add column if not exists tts_rate_sentences float not null default 1.0,
  add column if not exists tts_rate_words float not null default 1.0;

-- Add check constraints to ensure rates are within valid range (0.25 - 2.0)
alter table public.user_profiles
  add constraint tts_rate_sentences_range check (tts_rate_sentences >= 0.25 and tts_rate_sentences <= 2.0),
  add constraint tts_rate_words_range check (tts_rate_words >= 0.25 and tts_rate_words <= 2.0);

-- Add comment for documentation
comment on column public.user_profiles.tts_rate_sentences is 'TTS speaking rate for sentences and stories (0.25 - 2.0)';
comment on column public.user_profiles.tts_rate_words is 'TTS speaking rate for individual words (0.25 - 2.0)';
