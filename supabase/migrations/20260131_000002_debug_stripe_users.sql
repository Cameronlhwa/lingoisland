-- Debug: Check users with Stripe customer IDs but not Pro status
-- This helps identify users who paid but didn't get upgraded

-- Query 1: Users with stripe_customer_id but plan='free'
-- These are users who likely have a Stripe subscription but webhook didn't work
SELECT 
  u.id,
  u.email,
  u.created_at as user_created,
  p.plan,
  p.stripe_customer_id,
  p.stripe_subscription_id,
  p.current_period_end,
  p.created_at as profile_created,
  p.updated_at as profile_updated
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.stripe_customer_id IS NOT NULL
  AND p.plan = 'free'
ORDER BY u.created_at DESC;

-- This migration is for debugging only - it doesn't make any changes
-- Run this query manually in Supabase SQL editor to see affected users
