# Quick Fix Guide - Customer Data Loss

## 🚨 Immediate Actions

### 1. Apply Database Migration (5 minutes)

```bash
cd /Users/cameronlhwa/Langauge\ Website
supabase db push
```

This creates missing `profiles` entries for all users.

### 2. Deploy Code Changes (10 minutes)

The following files have been updated:
- ✅ `/app/auth/callback/route.ts` - Creates both profile tables on login
- ✅ `/app/login/page.tsx` - Creates both profile tables on email auth
- ✅ `/app/api/stripe/webhook/route.ts` - Better webhook logging
- ✅ `/supabase/migrations/20260131_000001_fix_profiles_backfill.sql` - Backfill migration

Deploy these changes to production immediately.

### 3. Manually Recover Affected User (5 minutes per user)

**OPTION A: Reconnect to Stripe Subscription**
```sql
-- Step 1: Find user ID
SELECT id, email FROM auth.users WHERE email = 'user@example.com';

-- Step 2: Update their profile with Stripe data
-- (Get stripe_customer_id and stripe_subscription_id from Stripe Dashboard)
UPDATE public.profiles
SET 
  stripe_customer_id = 'cus_xxxxxxxxxxxxx',  -- From Stripe
  stripe_subscription_id = 'sub_yyyyyyyyyyyyy',  -- From Stripe
  plan = 'pro',
  current_period_end = '2026-03-01 00:00:00+00'::timestamptz  -- From Stripe
WHERE id = 'USER_UUID_FROM_STEP_1';

-- Step 3: Verify
SELECT id, plan, stripe_customer_id, current_period_end 
FROM public.profiles 
WHERE id = 'USER_UUID_FROM_STEP_1';
```

**OPTION B: Grant Pro Manually (No Stripe, No Expiry)**
```sql
-- Grant lifetime Pro access to a user (useful for refunds, gifts, etc.)
UPDATE public.profiles
SET 
  plan = 'pro',
  current_period_end = NULL  -- NULL = no expiry
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);

-- Verify
SELECT id, email, plan, current_period_end
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'user@example.com';
```

**How Pro Detection Works:**
- User is Pro if `plan='pro'` AND either:
  - `current_period_end` is NULL (manual grant, no expiry) OR
  - `current_period_end` is in the future (active Stripe subscription)

## 🔍 How to Find Stripe Data

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/customers)
2. Search by user's email
3. Click on customer
4. Copy these values:
   - **Customer ID**: Shows at top (e.g., `cus_xxxxxxxxxxxxx`)
   - **Subscription ID**: In subscriptions tab (e.g., `sub_yyyyyyyyyyyyy`)
   - **Current Period End**: In subscription details (convert to ISO format)

## ✅ Verification Steps

After recovery:

```sql
-- Check user has correct plan
SELECT id, email FROM auth.users WHERE email = 'user@example.com';
-- Copy the id

SELECT 
  p.id,
  p.plan,
  p.stripe_customer_id,
  p.stripe_subscription_id,
  p.current_period_end,
  up.cefr_level,
  CASE 
    WHEN p.plan = 'pro' AND p.current_period_end IS NULL THEN 'Manual Grant (Lifetime)'
    WHEN p.plan = 'pro' AND p.current_period_end > now() THEN 'Active Subscription'
    WHEN p.plan = 'pro' AND p.current_period_end <= now() THEN 'Expired Subscription'
    ELSE 'Free'
  END as status
FROM profiles p
LEFT JOIN user_profiles up ON up.user_id = p.id
WHERE p.id = 'USER_ID_HERE';

-- Should show one of:
-- plan: 'pro', current_period_end: NULL -> Manual Grant (Lifetime)
-- plan: 'pro', current_period_end: (future date) -> Active Subscription
```

**List all Pro users:**
```sql
SELECT 
  u.email,
  p.plan,
  p.current_period_end,
  CASE 
    WHEN p.plan = 'pro' AND p.current_period_end IS NULL THEN 'Manual Grant (Lifetime)'
    WHEN p.plan = 'pro' AND p.current_period_end > now() THEN 'Active Subscription'
    WHEN p.plan = 'pro' AND p.current_period_end <= now() THEN 'Expired'
    ELSE 'Free'
  END as status
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.plan = 'pro'
ORDER BY p.current_period_end ASC NULLS FIRST;
```

## 📧 User Communication Template

```
Subject: Your LingoIsland Pro Subscription Restored

Hi [Name],

I've identified and fixed the issue with your account. Your Pro subscription has been restored and you should now have full access to all features.

Could you please:
1. Log out and log back in
2. Confirm you see "Pro" in your account
3. Verify all your learning data is intact

Your subscription will continue as normal - you won't be charged twice. I apologize for the inconvenience this caused.

If you have any other issues, please don't hesitate to reach out.

Best,
[Your name]
```

## 🐛 Debugging OAuth Errors

If users report `flow_state_not_found`:

1. **Check server logs** for:
   ```
   [AUTH CALLBACK] Flow state not found
   ```

2. **Cause**: User's OAuth session expired (took >10 min, cleared cookies, or navigated away)

3. **Solution**: Ask user to simply try logging in again

4. **Monitoring**: The new code logs these errors with full context for debugging

## 🔄 Testing Refund/Cancellation

To verify cancellation works:

1. **Trigger in Stripe Test Mode:**
   - Create test subscription (card: 4242 4242 4242 4242)
   - Cancel immediately in Stripe Dashboard
   
2. **Check webhook fired:**
   - Stripe Dashboard → Webhooks → View logs
   - Your server logs: `[STRIPE WEBHOOK] Subscription deleted`

3. **Verify database update:**
   ```sql
   SELECT plan FROM profiles WHERE id = 'test_user_id';
   -- Should be 'free'
   ```

## 📊 Current Status

**Files Changed:**
- ✅ 3 TypeScript files updated (auth callback, login page, webhook)
- ✅ 1 SQL migration created
- ✅ 2 documentation files created

**What's Fixed:**
- ✅ All users now get both profile tables created on login
- ✅ Existing users get missing `profiles` entries via migration
- ✅ OAuth errors logged with helpful context
- ✅ Webhook handles all subscription states properly
- ✅ Better logging throughout for debugging

**Still Required:**
- ⏳ Deploy code changes
- ⏳ Run migration
- ⏳ Manually recover affected users
- ⏳ Test in production

## 📞 Need Help?

See full details in:
- `CUSTOMER_DATA_RECOVERY.md` - Comprehensive recovery guide
- `supabase/migrations/20260131_000001_fix_profiles_backfill.sql` - Migration with inline docs
