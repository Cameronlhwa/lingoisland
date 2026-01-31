-- Emergency fix for subscription that was incorrectly set to lifetime
-- This happens when a subscription is reactivated but the webhook doesn't properly set current_period_end

-- First, let's see what subscriptions are affected
-- Run this first to see the current state:
SELECT 
  u.email,
  p.plan,
  p.current_period_end,
  p.cancel_at_period_end,
  p.stripe_subscription_id,
  p.stripe_customer_id
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.plan = 'pro' AND p.stripe_subscription_id IS NOT NULL
ORDER BY p.current_period_end ASC NULLS FIRST;

-- If you see subscriptions with NULL current_period_end but they HAVE stripe_subscription_id,
-- that means they were incorrectly set to lifetime access.

-- To fix a specific user (replace with the actual email):
-- NOTE: You need to get the correct current_period_end from Stripe first!
-- Go to Stripe → Customers → Find the customer → Click on subscription → Note the "Current period end" date

-- Example fix (UPDATE THE DATE TO MATCH STRIPE!):
UPDATE public.profiles
SET 
  current_period_end = '2026-02-28 00:00:00+00'::timestamptz,  -- REPLACE WITH CORRECT DATE FROM STRIPE
  cancel_at_period_end = false  -- Set to true if subscription is canceled but active
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'popcky12@gmail.com'  -- REPLACE WITH CORRECT EMAIL
);

-- After running this, the user should see the correct renewal date in the app.
