-- Manual fix for your current subscription issue
-- Run this in Supabase SQL Editor

-- First, check your current state
SELECT 
  u.email,
  p.plan,
  p.current_period_end,
  p.cancel_at_period_end,
  p.stripe_subscription_id,
  p.stripe_customer_id
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'popcky12@gmail.com';

-- If you see plan='pro' but no current_period_end, and the subscription is actually canceled in Stripe,
-- run this to downgrade to free:

UPDATE public.profiles
SET 
  plan = 'free',
  stripe_subscription_id = null,
  current_period_end = null,
  cancel_at_period_end = false
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'popcky12@gmail.com'
);

-- Verify the fix:
SELECT 
  u.email,
  p.plan,
  p.current_period_end,
  p.stripe_subscription_id
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'popcky12@gmail.com';
