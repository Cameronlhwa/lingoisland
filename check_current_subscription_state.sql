-- Check current subscription state for popcky12
SELECT 
  p.id as user_id,
  au.email,
  p.plan,
  p.stripe_customer_id,
  p.stripe_subscription_id,
  p.current_period_end,
  p.cancel_at_period_end,
  CASE 
    WHEN p.plan = 'pro' AND p.cancel_at_period_end = true AND p.current_period_end > now() THEN 'Canceled (Active until end)'
    WHEN p.plan = 'pro' AND p.cancel_at_period_end = false AND p.current_period_end > now() THEN 'Active (Will renew)'
    WHEN p.plan = 'pro' AND p.current_period_end IS NULL THEN 'Manual Grant (Lifetime)'
    WHEN p.plan = 'pro' AND p.current_period_end <= now() THEN 'Expired'
    ELSE 'Free'
  END as subscription_status
FROM profiles p
LEFT JOIN auth.users au ON p.id = au.id
WHERE au.email = 'popcky12@gmail.com';
