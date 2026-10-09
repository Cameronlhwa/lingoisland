# Stripe Pro Status Bug - Troubleshooting & Fix Guide

## Problem
Users who upgraded via Stripe payment are being charged but their `profiles.plan` remains `'free'` instead of being updated to `'pro'`.

## Root Causes (Possible)

### 1. Webhook Not Configured in Stripe
**Symptom:** No webhook events are being received by the app  
**Check:** Go to Stripe Dashboard → Developers → Webhooks  
**Fix:** 
- Add webhook endpoint: `https://yourdomain.com/api/stripe/webhook`
- Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Copy webhook signing secret to `.env.local` as `STRIPE_WEBHOOK_SECRET`

### 2. Webhook Secret Mismatch
**Symptom:** Webhook returns 400 "Invalid signature" errors  
**Check:** Stripe Dashboard → Webhooks → Click your endpoint → View logs  
**Fix:** Update `STRIPE_WEBHOOK_SECRET` in `.env.local` with correct value from Stripe

### 3. Profile Doesn't Exist When Webhook Fires
**Symptom:** Webhook logs show "Failed to upsert subscription" or similar error  
**Check:** Run the debug query below to see users with stripe_customer_id but no profile  
**Fix:** Migration `20260131_000001_fix_profiles_backfill.sql` should have created profiles for all users

### 4. Webhook Can't Resolve User ID
**Symptom:** Webhook logs show "Could not resolve user for checkout/update/delete"  
**Root cause:** 
- The checkout session didn't include `client_reference_id` or `metadata.user_id`
- The Stripe customer wasn't linked to the profile (`stripe_customer_id` mismatch)
- The subscription metadata is missing

**Fix:** Code has been updated to pass user_id in multiple places:
- `app/api/stripe/checkout/route.ts` now sets `client_reference_id` AND `subscription_data.metadata.user_id`
- Webhook tries to resolve user in this order:
  1. `subscription.metadata.user_id`
  2. `session.client_reference_id`
  3. Lookup by `stripe_customer_id` in profiles table

## Debugging Steps

### Step 1: Check which users are affected

Run this query in Supabase SQL Editor:

\`\`\`sql
SELECT 
  u.id as user_id,
  u.email,
  u.created_at as user_created,
  p.plan,
  p.stripe_customer_id,
  p.stripe_subscription_id,
  p.current_period_end
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.stripe_customer_id IS NOT NULL
  AND p.plan = 'free'
ORDER BY u.created_at DESC;
\`\`\`

This shows users who have a Stripe customer ID but are still marked as free.

### Step 2: Check Stripe Dashboard

For each affected user:
1. Go to Stripe Dashboard → Customers
2. Search by email
3. Check if they have an active subscription
4. Note the subscription ID and current period end date

### Step 3: Check webhook logs

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click on your webhook endpoint
3. Look for events related to the affected users
4. Check if events succeeded or failed
5. Look at the response body for any errors

### Step 4: Check application logs

If you have access to your deployment logs (Vercel, etc):
- Search for `[STRIPE WEBHOOK]` logs
- Look for errors or warnings
- Check if user ID resolution is failing

## Manual Fix for Affected Users

Once you've confirmed a user should have Pro status:

### Option A: If they have an active Stripe subscription

\`\`\`sql
-- Replace these values with actual data from Stripe dashboard:
-- USER_UUID: Get from the debug query above
-- sub_XXXXX: Subscription ID from Stripe
-- cus_YYYYY: Customer ID from Stripe (should match stripe_customer_id)
-- 2026-03-01: Current period end date from Stripe

UPDATE profiles
SET 
  plan = 'pro',
  stripe_subscription_id = 'sub_XXXXXXXXXXXXX',
  current_period_end = '2026-03-01 00:00:00+00'::timestamptz
WHERE id = 'USER_UUID_HERE';
\`\`\`

### Option B: Give them Pro manually (no expiry) as compensation

If the webhook issue caused problems and you want to give them lifetime Pro:

\`\`\`sql
UPDATE profiles
SET 
  plan = 'pro',
  current_period_end = NULL  -- NULL = no expiry (lifetime pro)
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);
\`\`\`

## Preventing Future Issues

### 1. Verify webhook is working

Test the webhook:
1. Go to Stripe Dashboard → Developers → Webhooks
2. Click your webhook
3. Click "Send test webhook"
4. Send a `checkout.session.completed` event
5. Check your app logs to see if it's received

### 2. Add webhook event logging

Consider adding a database table to log all webhook events:

\`\`\`sql
CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  event_id text NOT NULL UNIQUE,
  customer_id text,
  user_id uuid,
  success boolean NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
\`\`\`

### 3. Add monitoring

Set up alerts for:
- Webhook failures (Stripe Dashboard)
- Users with `stripe_customer_id` but `plan='free'`
- Subscription payments without corresponding pro status updates

## Bulk Fix Script

If you have many affected users, use this helper function:

\`\`\`sql
CREATE OR REPLACE FUNCTION fix_stripe_subscription(
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

  RETURN 'SUCCESS: Fixed subscription for ' || p_user_email;
END;
$$;

-- Usage:
-- SELECT fix_stripe_subscription(
--   'user@example.com',
--   'sub_1234567890',
--   '2026-02-28 00:00:00+00'
-- );
\`\`\`

## Testing the Fix

After fixing affected users:

1. Have them log out and log back in
2. Check that they see "Pro" badge in account modal
3. Verify they can create unlimited topic islands
4. Check that all words (1-20) are unlocked for them

## Summary

The issue is that Stripe webhooks aren't properly updating the `profiles` table when users subscribe. The fix requires:

1. **Immediate:** Manually update affected users' profiles using SQL
2. **Short-term:** Verify webhook is properly configured in Stripe
3. **Long-term:** Add webhook event logging and monitoring to catch future issues
