# Quick Fix Steps for Affected Pro Users

## Immediate Action Required

Users who paid but didn't get Pro status need to be fixed manually. Follow these steps:

### Step 1: Identify Affected Users

Run this in Supabase SQL Editor:

```sql
SELECT 
  u.id as user_id,
  u.email,
  p.plan,
  p.stripe_customer_id,
  p.stripe_subscription_id,
  p.current_period_end
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.stripe_customer_id IS NOT NULL
  AND p.plan = 'free'
ORDER BY u.created_at DESC;
```

This will show you all users who have a Stripe customer ID but are still on the free plan.

### Step 2: Check Stripe Dashboard

For each affected user's email:

1. Go to [Stripe Dashboard → Customers](https://dashboard.stripe.com/customers)
2. Search by email
3. Click on their subscription
4. Note these details:
   - **Subscription ID** (starts with `sub_`)
   - **Current period end** date
   - **Status** (should be "Active")

### Step 3: Apply the Migration

First, apply the new migration to create the fix functions:

```bash
# Push the new migration to Supabase
npx supabase db push
```

Or manually run the migration file `20260131_000003_fix_stripe_subscriptions.sql` in Supabase SQL Editor.

### Step 4: Fix Each User

For each affected user, run this in Supabase SQL Editor:

```sql
-- Replace with actual values from Stripe dashboard
SELECT fix_stripe_subscription_by_email(
  'user@example.com',              -- User's email
  'sub_1234567890ABCDEF',          -- Subscription ID from Stripe
  '2026-03-01 00:00:00+00'::timestamptz  -- Current period end from Stripe
);
```

You should see: `SUCCESS: Fixed subscription for user@example.com`

### Step 5 (Alternative): Grant Lifetime Pro

If you want to give them lifetime Pro access as compensation for the inconvenience:

```sql
SELECT grant_manual_pro('user@example.com');
```

This gives them Pro with no expiry date (they won't be charged again unless they manually subscribe later).

### Step 6: Verify the Fix

Have the user:
1. Log out and log back in
2. Open Account modal
3. Verify they see "Pro" badge
4. Try creating a topic island (should work)
5. Verify all 20 words are unlocked

### Step 7: Fix the Root Cause

The webhook isn't working properly. Check these:

#### 7a. Verify Webhook is Configured in Stripe

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Check if webhook endpoint exists: `https://yourdomain.com/api/stripe/webhook`
3. Verify these events are selected:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

If not configured:
- Click "Add endpoint"
- Enter your webhook URL
- Select the 3 events above
- Copy the **Signing secret** 
- Add to `.env.local` as `STRIPE_WEBHOOK_SECRET=whsec_...`
- Redeploy your app

#### 7b. Check Webhook Logs

1. In Stripe Dashboard → Webhooks → Click your endpoint
2. Look for recent events
3. Check if any failed (will show red)
4. Click on failed events to see error details

Common errors:
- **401 Unauthorized**: Webhook secret is wrong or missing
- **500 Internal Server Error**: Check your application logs
- **Timeout**: Your webhook endpoint is too slow

#### 7c. Test the Webhook

1. In Stripe Dashboard → Webhooks → Your endpoint
2. Click "Send test webhook"
3. Select `checkout.session.completed`
4. Send it
5. Check your application logs for `[STRIPE WEBHOOK]` entries

With the enhanced logging added, you'll see detailed information about what's happening.

### Step 8: Deploy the Fixes

The code changes made include:

1. **Enhanced webhook logging** - See exactly what's happening in each webhook event
2. **Better error handling** - More detailed error messages when user resolution fails
3. **Migration functions** - Easy SQL functions to fix users

Deploy these changes:

```bash
git add .
git commit -m "Fix Stripe webhook user resolution and add manual fix functions"
git push
```

Then verify the webhook is receiving events by checking your deployment logs (Vercel/etc).

## Summary Checklist

- [ ] Run debug query to identify affected users
- [ ] Check each user in Stripe dashboard
- [ ] Apply migration (20260131_000003)
- [ ] Fix each user with `fix_stripe_subscription_by_email()`
- [ ] Verify users can see Pro status
- [ ] Configure webhook in Stripe dashboard
- [ ] Add `STRIPE_WEBHOOK_SECRET` to environment variables
- [ ] Deploy code changes
- [ ] Test webhook with Stripe test events
- [ ] Monitor logs for `[STRIPE WEBHOOK]` entries

## Need Help?

If you're stuck, check:
1. Application logs for `[STRIPE WEBHOOK]` entries
2. Stripe webhook logs for failures
3. Supabase logs for database errors
4. The detailed guide in `STRIPE_PRO_BUG_FIX.md`
