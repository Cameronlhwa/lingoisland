-- This script will help us manually sync popcky12's subscription from Stripe
-- First, let's see what's currently in the database:

SELECT 
  p.id as user_id,
  p.email,
  p.plan,
  p.stripe_customer_id,
  p.stripe_subscription_id,
  p.current_period_end,
  p.cancel_at_period_end,
  au.email as auth_email
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE au.email = 'popcky12@gmail.com';

-- If current_period_end is NULL or in the past, but you should still have access,
-- we need to update it with the correct date from Stripe.
-- 
-- You mentioned you canceled but still have "almost a month" left.
-- When did you cancel? We need to set current_period_end to the end of your billing period.
--
-- Example fix (replace the date with your actual period end date):
-- UPDATE profiles
-- SET 
--   plan = 'pro',
--   current_period_end = '2026-02-28T23:59:59.000Z',  -- Replace with actual date
--   cancel_at_period_end = true
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'popcky12@gmail.com');
