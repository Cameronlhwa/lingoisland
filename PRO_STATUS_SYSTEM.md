# Pro Status System - How It Works

## Overview

LingoIsland supports **two ways** for users to have Pro status:

1. **Active Stripe Subscription** - User pays monthly/yearly
2. **Manual Grant** - Admin gives lifetime Pro access (no payment required)

Both are treated identically in the app - users get full Pro features either way.

## Database Structure

The `profiles` table tracks billing status:

```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY,
  plan text NOT NULL DEFAULT 'free',  -- 'free' or 'pro'
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz      -- NULL or future date
);
```

## Pro Detection Logic

A user is considered **Pro** if:

```typescript
plan === 'pro' AND (
  current_period_end === null OR          // Manual grant (no expiry)
  current_period_end > now()              // Active subscription
)
```

This logic is implemented in `lib/entitlements.ts`:

```typescript
const isPro =
  plan === "pro" &&
  (!currentPeriodEnd || currentPeriodEnd.getTime() > Date.now());
```

## Two Types of Pro Status

### Type 1: Active Stripe Subscription

**Database values:**

```sql
plan = 'pro'
stripe_customer_id = 'cus_xxxxxxxxxxxxx'
stripe_subscription_id = 'sub_yyyyyyyyyyyyy'
current_period_end = '2026-03-01 00:00:00+00'  -- Future date
```

**Characteristics:**

- ✅ User pays monthly/yearly
- ✅ Managed through Stripe
- ✅ Auto-renews until canceled
- ✅ Shows renewal date in UI: "Renews on March 1, 2026"
- ✅ Webhook automatically updates on cancel/renewal

**How to set up:**

```sql
-- Automatically handled by Stripe webhook when user subscribes
-- Or manually reconnect:
UPDATE profiles
SET
  stripe_customer_id = 'cus_xxxxxxxxxxxxx',
  stripe_subscription_id = 'sub_yyyyyyyyyyyyy',
  plan = 'pro',
  current_period_end = '2026-03-01 00:00:00+00'
WHERE id = 'USER_UUID';
```

### Type 2: Manual Pro Grant (Lifetime)

**Database values:**

```sql
plan = 'pro'
stripe_customer_id = NULL
stripe_subscription_id = NULL
current_period_end = NULL  -- NULL means no expiry
```

**Characteristics:**

- ✅ No payment required
- ✅ Never expires (lifetime access)
- ✅ No renewal date shown in UI
- ✅ Perfect for refunds, gifts, beta testers, staff, etc.

**How to set up:**

```sql
-- Grant lifetime Pro to a user
UPDATE profiles
SET
  plan = 'pro',
  current_period_end = NULL
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);
```

## Use Cases for Manual Grants

**When to use Type 2 (Manual Grant):**

1. **Refunds** - User had issues, refunded payment, but you want them to keep access
2. **Compensation** - User experienced bugs/downtime, gift Pro as apology
3. **Beta Testers** - Early adopters who helped test the app
4. **Staff/Team** - Give team members free access
5. **Partnerships** - Grant access to partners, influencers, reviewers
6. **Promotions** - Temporary campaigns (though you could set an expiry date)
7. **Education** - Teachers, students, educational programs

## How It Looks in the UI

### For Type 1 (Stripe Subscription):

```
┌─────────────────────────────────────┐
│ Subscription                    Pro │
│                                     │
│ Renews on March 1, 2026            │
│                                     │
│ [Manage Subscription]              │
└─────────────────────────────────────┘
```

### For Type 2 (Manual Grant):

```
┌─────────────────────────────────────┐
│ Subscription                    Pro │
│                                     │
│ (No renewal date shown)            │
│                                     │
│ (No manage button - not in Stripe) │
└─────────────────────────────────────┘
```

## SQL Queries for Management

### Check a user's Pro status:

```sql
SELECT
  u.email,
  p.plan,
  p.current_period_end,
  CASE
    WHEN p.plan = 'pro' AND p.current_period_end IS NULL
      THEN 'Manual Grant (Lifetime)'
    WHEN p.plan = 'pro' AND p.current_period_end > now()
      THEN 'Active Subscription'
    WHEN p.plan = 'pro' AND p.current_period_end <= now()
      THEN 'Expired Subscription'
    ELSE 'Free'
  END as status
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'user@example.com';
```

### List all Pro users by type:

```sql
SELECT
  u.email,
  CASE
    WHEN p.current_period_end IS NULL THEN 'Manual Grant'
    ELSE 'Stripe Subscription'
  END as pro_type,
  p.current_period_end,
  p.stripe_customer_id
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.plan = 'pro'
  AND (p.current_period_end IS NULL OR p.current_period_end > now())
ORDER BY pro_type, u.email;
```

### Find expired subscriptions:

```sql
SELECT
  u.email,
  p.plan,
  p.current_period_end
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.plan = 'pro'
  AND p.current_period_end IS NOT NULL
  AND p.current_period_end <= now()
ORDER BY p.current_period_end DESC;
```

## Converting Between Types

### Convert Manual Grant → Stripe Subscription:

```sql
-- User starts paying after having lifetime access
UPDATE profiles
SET
  stripe_customer_id = 'cus_xxxxxxxxxxxxx',
  stripe_subscription_id = 'sub_yyyyyyyyyyyyy',
  current_period_end = '2026-03-01 00:00:00+00'
WHERE id = 'USER_UUID';
```

### Convert Stripe Subscription → Manual Grant:

```sql
-- User cancels Stripe but you want them to keep access
UPDATE profiles
SET
  stripe_customer_id = NULL,  -- Or keep for records
  stripe_subscription_id = NULL,
  current_period_end = NULL   -- NULL = lifetime
WHERE id = 'USER_UUID';
```

### Downgrade to Free:

```sql
-- Remove Pro access
UPDATE profiles
SET
  plan = 'free',
  current_period_end = NULL
WHERE id = 'USER_UUID';
```

## Important Notes

1. **Both types are equal** - The app treats both types identically. All Pro features work the same way.

2. **Stripe webhooks only affect Type 1** - Webhooks automatically update subscription status for Stripe users. Manual grants are unaffected.

3. **No "hybrid" mode** - A user is either:
   - Free
   - Pro via Stripe (with expiry date)
   - Pro via manual grant (no expiry)

4. **Cancellation behavior**:
   - Type 1: Stripe webhook sets `plan='free'` when subscription cancels
   - Type 2: Must be manually changed back to free (won't auto-expire)

5. **UI adapts automatically** - No code changes needed. The UI shows/hides the renewal date based on whether `current_period_end` is NULL.

## Testing

### Test Manual Grant:

```sql
-- Grant yourself Pro
UPDATE profiles
SET plan = 'pro', current_period_end = NULL
WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');

-- Then log out and log back in
-- Verify you see "Pro" badge
-- Verify no renewal date is shown
-- Verify you can create unlimited islands
```

### Test Stripe Subscription:

```sql
-- Set test subscription (use Stripe test mode data)
UPDATE profiles
SET
  plan = 'pro',
  stripe_customer_id = 'cus_test_xxxxx',
  stripe_subscription_id = 'sub_test_yyyyy',
  current_period_end = (now() + interval '30 days')
WHERE id = 'YOUR_USER_ID';

-- Verify you see "Pro" badge
-- Verify renewal date shows
-- Verify "Manage Subscription" button appears
```

## Summary

The dual pro status system provides flexibility:

- **Stripe subscriptions** for paying customers (auto-managed)
- **Manual grants** for special cases (admin-managed)

Both are detected by the same simple logic: `plan='pro'` and no expiry. This keeps the codebase simple while supporting diverse business needs.
