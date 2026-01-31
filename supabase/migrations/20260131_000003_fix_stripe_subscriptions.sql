-- Fix users who paid via Stripe but didn't get Pro status
-- This migration creates helper functions to fix users with active Stripe subscriptions

-- Function 1: Fix by user ID (when you have the UUID)
CREATE OR REPLACE FUNCTION fix_stripe_subscription_by_id(
  p_user_id uuid,
  p_stripe_subscription_id text,
  p_current_period_end timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email text;
BEGIN
  -- Get user email for logging
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = p_user_id;

  IF v_email IS NULL THEN
    RETURN 'ERROR: User not found with ID ' || p_user_id::text;
  END IF;

  -- Update the user's profile to Pro status
  UPDATE profiles
  SET 
    plan = 'pro',
    stripe_subscription_id = p_stripe_subscription_id,
    current_period_end = p_current_period_end
  WHERE id = p_user_id;

  RETURN 'SUCCESS: Fixed subscription for ' || v_email || ' (ID: ' || p_user_id::text || ')';
END;
$$;

-- Function 2: Fix by email (easier to use when you know user's email)
CREATE OR REPLACE FUNCTION fix_stripe_subscription_by_email(
  p_user_email text,
  p_stripe_subscription_id text,
  p_current_period_end timestamptz
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Find user ID by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_user_email;

  IF v_user_id IS NULL THEN
    RETURN 'ERROR: User not found with email ' || p_user_email;
  END IF;

  -- Update profile
  UPDATE profiles
  SET 
    plan = 'pro',
    stripe_subscription_id = p_stripe_subscription_id,
    current_period_end = p_current_period_end
  WHERE id = v_user_id;

  RETURN 'SUCCESS: Fixed subscription for ' || p_user_email || ' (ID: ' || v_user_id::text || ')';
END;
$$;

-- Function 3: Grant Pro manually (no Stripe subscription, no expiry)
-- Useful for compensation, refunds, or giving free Pro access
CREATE OR REPLACE FUNCTION grant_manual_pro(
  p_user_email text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Find user ID by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_user_email;

  IF v_user_id IS NULL THEN
    RETURN 'ERROR: User not found with email ' || p_user_email;
  END IF;

  -- Grant lifetime Pro (no expiry)
  UPDATE profiles
  SET 
    plan = 'pro',
    current_period_end = NULL  -- NULL = no expiry
  WHERE id = v_user_id;

  RETURN 'SUCCESS: Granted lifetime Pro to ' || p_user_email || ' (ID: ' || v_user_id::text || ')';
END;
$$;

-- Usage examples:

-- Fix by email (recommended - easier to use):
-- SELECT fix_stripe_subscription_by_email(
--   'user@example.com',
--   'sub_1234567890ABCDEF',
--   '2026-03-01 00:00:00+00'::timestamptz
-- );

-- Fix by user ID:
-- SELECT fix_stripe_subscription_by_id(
--   '12345678-1234-1234-1234-123456789abc'::uuid,
--   'sub_1234567890ABCDEF',
--   '2026-03-01 00:00:00+00'::timestamptz
-- );

-- Grant manual Pro (no Stripe subscription):
-- SELECT grant_manual_pro('user@example.com');

-- To find affected users, run this query:
-- SELECT 
--   u.id as user_id,
--   u.email,
--   p.plan,
--   p.stripe_customer_id,
--   p.stripe_subscription_id,
--   p.current_period_end
-- FROM auth.users u
-- LEFT JOIN profiles p ON p.id = u.id
-- WHERE p.stripe_customer_id IS NOT NULL
--   AND p.plan = 'free'
-- ORDER BY u.created_at DESC;
