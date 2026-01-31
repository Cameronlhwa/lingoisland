-- Fix profiles table missing entries
-- This migration ensures all existing auth.users have a corresponding entry in profiles
-- Critical for users who signed up before the profiles table was created

-- 1. Insert missing profiles for all auth.users that don't have a profiles entry
insert into public.profiles (id, plan, current_period_end)
select 
  au.id,
  'free' as plan,
  null as current_period_end
from auth.users au
left join public.profiles p on p.id = au.id
where p.id is null
on conflict (id) do nothing;

-- 2. For users who have stripe_customer_id in metadata but not in profiles, update profiles
-- This handles cases where Stripe webhook may have failed to link customer
-- Note: This assumes stripe_customer_id might be stored in user metadata
-- If you have a separate way to identify which users should be pro, adjust this query

-- 3. Update the is_word_locked function to support BOTH Stripe subscriptions AND manual pro grants
-- Users are considered pro if:
--   - plan = 'pro' AND current_period_end IS NULL (manually granted, no expiry)
--   - plan = 'pro' AND current_period_end > now() (active Stripe subscription)
drop function if exists public.is_word_locked(int, uuid);
create or replace function public.is_word_locked(
  p_word_position int,
  p_user_id uuid
) returns boolean as $$
declare
  user_plan text;
  user_period_end timestamptz;
  is_pro_active boolean;
begin
  -- Get user plan
  select plan, current_period_end into user_plan, user_period_end
  from public.profiles
  where id = p_user_id;

  -- If no profile found, default to free
  if user_plan is null then
    user_plan := 'free';
  end if;

  -- Check if pro is active:
  -- Option 1: Manual grant (plan='pro' and period_end is NULL - no expiry)
  -- Option 2: Active subscription (plan='pro' and period_end is in future)
  is_pro_active := user_plan = 'pro' and (
    user_period_end is null or user_period_end > now()
  );

  -- Free users: words with position > 10 are locked
  -- Pro users: no words are locked
  if is_pro_active then
    return false;
  else
    return p_word_position > 10;
  end if;
end;
$$ language plpgsql security definer;

-- 4. Add a helpful comment
comment on table public.profiles is 'Billing profiles table - one entry per user. Separate from user_profiles which stores app settings. For pro status: plan=''pro'' with current_period_end=NULL means manual grant (no expiry), or current_period_end in future means active Stripe subscription.';
comment on table public.user_profiles is 'User app settings (CEFR level, TTS rate, etc). Separate from profiles which stores billing info.';

-- 5. Helpful queries for checking pro status
-- 
-- List all Pro users with their subscription type:
-- SELECT 
--   u.email,
--   p.plan,
--   p.current_period_end,
--   CASE 
--     WHEN p.plan = 'pro' AND p.current_period_end IS NULL THEN 'Manual Grant (Lifetime)'
--     WHEN p.plan = 'pro' AND p.current_period_end > now() THEN 'Active Subscription'
--     WHEN p.plan = 'pro' AND p.current_period_end <= now() THEN 'Expired Subscription'
--     ELSE 'Free'
--   END as status
-- FROM public.profiles p
-- JOIN auth.users u ON u.id = p.id
-- WHERE p.plan = 'pro'
-- ORDER BY p.current_period_end ASC NULLS FIRST;

-- 5. IMPORTANT: Manual recovery step required
-- If you have users who lost their subscription after the stripe-paywall migration:
-- 
-- OPTION A: Reconnect to existing Stripe subscription
-- Step 1: In Stripe dashboard, find the customer by email
-- Step 2: Get their stripe_customer_id (starts with "cus_")
-- Step 3: Get their stripe_subscription_id (starts with "sub_") 
-- Step 4: Find the user_id from auth.users by email
-- Step 5: Run this UPDATE query to reconnect them:
-- 
-- UPDATE public.profiles
-- SET 
--   stripe_customer_id = 'cus_XXXXXXXXXXXXX',
--   stripe_subscription_id = 'sub_YYYYYYYYYYYYYY',
--   plan = 'pro',
--   current_period_end = '2026-03-01 00:00:00+00'::timestamptz  -- Get from Stripe
-- WHERE id = 'USER_UUID_HERE';
--
-- OPTION B: Grant Pro manually (no Stripe subscription, no expiry)
-- This is useful for giving free Pro access to specific users
--
-- UPDATE public.profiles
-- SET 
--   plan = 'pro',
--   current_period_end = NULL  -- NULL means no expiry (lifetime pro)
-- WHERE id = (
--   SELECT id FROM auth.users WHERE email = 'user@example.com'
-- );
--
-- Note: Users are considered Pro if plan='pro' AND either:
--   - current_period_end is NULL (manual grant, no expiry)
--   - current_period_end is in the future (active Stripe subscription)
