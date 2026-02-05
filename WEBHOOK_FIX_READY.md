# Subscription Webhook Fix - Ready to Push

## What Was Fixed

### Problem:

When you unsubscribed through Stripe portal, you remained as "Pro" with "Lifetime access" instead of being downgraded to Free.

### Root Cause:

The webhook received the `customer.subscription.deleted` event but couldn't resolve your user_id. Instead of returning an error (which would make Stripe retry), it silently skipped processing and returned success. This left your subscription in a broken state.

### The Fix:

Changed webhook behavior to return a 400 error when it can't resolve the user ID. This causes Stripe to automatically retry the webhook, giving it another chance to process the event correctly.

## Changes Made (Local, Ready to Push):

### 1. Revert Commit (Already Local)

Removed the "Sync from Stripe" button and related code - we want webhooks to work properly, not band-aid solutions.

### 2. Webhook Error Handling (Already Local)

- Webhook now returns 400 error if it can't find user for subscription updates/deletions
- Stripe will automatically retry failed webhooks
- Added prominent warning logs to identify resolution failures
- Prevents silent failures that leave accounts in broken state

## What You Need to Do:

### Step 1: Fix Your Current Account Manually

Run the SQL in `fix_my_subscription.sql`:

```sql
UPDATE public.profiles
SET
  plan = 'free',
  stripe_subscription_id = null,
  current_period_end = null,
  cancel_at_period_end = false
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'popcky12@gmail.com'
);
```

This will immediately downgrade you to Free.

### Step 2: Push the Webhook Fix

```bash
git push
```

Wait for Vercel deployment (2-3 minutes).

### Step 3: Test

1. Subscribe again through your app
2. Cancel through Stripe portal
3. Should be immediately downgraded to Free (or kept Pro until period end if you chose that option)

## How It Works Now:

### When User Cancels Subscription:

**Scenario A: Cancel at Period End**

1. Stripe sends `customer.subscription.updated` with `cancel_at_period_end: true`
2. Webhook resolves user ID by `stripe_customer_id` lookup
3. Updates database: keeps `plan: "pro"` but sets `cancel_at_period_end: true`
4. User stays Pro until `current_period_end`
5. At period end, Stripe sends `customer.subscription.deleted`
6. Webhook downgrades user to Free

**Scenario B: Cancel Immediately**

1. Stripe sends `customer.subscription.deleted` immediately
2. Webhook resolves user ID
3. If resolution fails, returns 400 error → Stripe retries
4. Once successful, updates database: `plan: "free"`, clears all subscription fields
5. User is immediately downgraded

### User ID Resolution Methods (in order):

1. Try subscription metadata `user_id` (set during checkout)
2. Try session `client_reference_id` (for checkout events)
3. Look up user by `stripe_customer_id` in profiles table
4. If all fail → return 400 error (Stripe will retry)

## Files Changed:

- ✅ `app/api/stripe/webhook/route.ts` - Better error handling
- ✅ `fix_my_subscription.sql` - Manual fix for your account

## Files Reverted (No longer included):

- ❌ `app/api/stripe/sync-subscription/route.ts` - Removed
- ❌ Sync button in AccountModal - Removed
- ❌ Out-of-sync warning - Removed

## Ready to Push?

Everything is committed and ready:

```bash
git push
```

Let me know when you've pushed and I can help verify it's working!
