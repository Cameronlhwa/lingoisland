-- Check popcky12's current profile data
SELECT 
  id,
  email,
  plan,
  stripe_customer_id,
  stripe_subscription_id,
  current_period_end,
  cancel_at_period_end,
  created_at,
  updated_at
FROM profiles
WHERE email = 'popcky12@gmail.com';

-- Check if they have a Stripe customer/subscription ID
-- If they do, we need to sync from Stripe
