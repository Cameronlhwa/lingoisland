-- Check onboarding state for current user
-- Run this in Supabase SQL Editor to debug why nudges aren't showing

-- 1. Check if user_onboarding table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'user_onboarding'
) as table_exists;

-- 2. Check your onboarding row (replace 'YOUR_USER_ID' with your actual user ID from auth.users)
-- To find your user ID: SELECT id FROM auth.users WHERE email = 'your@email.com';
SELECT 
  user_id,
  onboarding_started_at,
  onboarding_ends_at,
  onboarding_disabled,
  steps_completed,
  steps_dismissed,
  last_nudge_shown_at,
  entry_source,
  now() as current_time,
  CASE 
    WHEN onboarding_ends_at IS NULL THEN 'No window set'
    WHEN now() < onboarding_ends_at THEN 'Window active ✓'
    ELSE 'Window expired ✗'
  END as window_status
FROM public.user_onboarding
WHERE user_id = 'YOUR_USER_ID';

-- 3. Check island count for your user
SELECT COUNT(*) as island_count
FROM public.topic_islands
WHERE user_id = 'YOUR_USER_ID';

-- 4. If no row exists, you need to load the app (it will create the row)
-- 5. If window is expired, delete the row and reload:
-- DELETE FROM public.user_onboarding WHERE user_id = 'YOUR_USER_ID';
