# Customer Data Loss Recovery Guide

## Issue Summary

After the `stripe-paywall` commit (9ec6387), users who previously had paid subscriptions lost their data because:

1. **Two separate profile tables were introduced:**
   - `user_profiles` - for app settings (CEFR level, TTS rate)
   - `profiles` - for billing data (Stripe customer ID, plan, subscription)

2. **Auth callback only created `user_profiles`:**
   - Existing users logging in via Google OAuth only got `user_profiles` entries
   - No `profiles` entry was created for billing data
   - Without `profiles`, users defaulted to "free" tier

3. **Stripe webhooks couldn't link subscriptions:**
   - Webhooks look up users in `profiles` by `stripe_customer_id`
   - Since existing users had no `profiles` entry, webhook couldn't connect subscription
   - User remained "free" despite having active Stripe subscription

4. **Result:** User paid for pro, but app showed free tier with no access to their data

## Fixes Applied

### 1. Database Migration: `20260131_000001_fix_profiles_backfill.sql`

**What it does:**

- Creates `profiles` entries for ALL existing `auth.users` who don't have one
- Sets default plan to "free" (manual recovery needed for paid users)
- Adds helpful comments to distinguish the two profile tables
- Includes step-by-step manual recovery instructions

**To run:**

```bash
# Apply the migration
supabase db push

# Or manually run in SQL editor
# Copy contents of supabase/migrations/20260131_000001_fix_profiles_backfill.sql
```

### 2. Auth Callback Updates: `/app/auth/callback/route.ts`

**Changes:**

- ✅ Creates BOTH `user_profiles` AND `profiles` on OAuth login
- ✅ Creates BOTH tables for email verification/signup
- ✅ Detailed logging for OAuth errors (especially `flow_state_not_found`)
- ✅ User-friendly error redirects with helpful messages

**Key code addition:**

```typescript
// Check if profiles (billing) exists, create if needed
const { data: existingProfile } = await supabase
  .from("profiles")
  .select("id")
  .eq("id", user.id)
  .single();

if (!existingProfile) {
  await supabase.from("profiles").insert({
    id: user.id,
    plan: "free",
  });
}
```

### 3. Login Page Updates: `/app/login/page.tsx`

**Changes:**

- ✅ `ensureUserProfile()` now creates BOTH profile tables
- ✅ Applies to email/password login flow
- ✅ Consistent behavior across all auth methods

### 4. Webhook Improvements: `/app/api/stripe/webhook/route.ts`

**Changes:**

- ✅ Better logging for subscription events
- ✅ Handles `canceled` and `unpaid` subscription statuses
- ✅ Clear logs when subscription is cleared or activated
- ✅ Easier debugging for future issues

## Manual Recovery for Affected Users

### Quick Recovery Steps

For each affected user (reported lost subscription):

**1. Get Stripe Information**

Go to [Stripe Dashboard](https://dashboard.stripe.com/customers) → Search customer by email

Copy these values:

- Customer ID: `cus_xxxxxxxxxxxxx`
- Subscription ID: `sub_yyyyyyyyyyyyy`
- Current Period End: `2026-03-01 12:00:00` (convert to ISO format)

**2. Get User ID from Database**

```sql
SELECT id, email
FROM auth.users
WHERE email = 'affected.user@example.com';
```

Copy the `id` (UUID format)

**3. Reconnect User to Stripe (Option A) OR Grant Pro Manually (Option B)**

**Option A: Reconnect to Existing Stripe Subscription**

```sql
UPDATE public.profiles
SET
  stripe_customer_id = 'cus_xxxxxxxxxxxxx',
  stripe_subscription_id = 'sub_yyyyyyyyyyyyy',
  plan = 'pro',
  current_period_end = '2026-03-01 12:00:00+00'::timestamptz
WHERE id = 'USER_UUID_FROM_STEP_2';
```

**Option B: Grant Pro Manually (No Stripe, Lifetime Access)**

```sql
-- Use this for refunds, compensation, or giving free Pro access
UPDATE public.profiles
SET
  plan = 'pro',
  current_period_end = NULL  -- NULL means no expiry
WHERE id = 'USER_UUID_FROM_STEP_2';
```

> **Note:** The system detects Pro status if `plan='pro'` AND either:
>
> - `current_period_end = NULL` (manual grant, no expiry)
> - `current_period_end > now()` (active Stripe subscription)

**4. Verify in Database**

```sql
SELECT id, plan, stripe_customer_id, stripe_subscription_id, current_period_end
FROM public.profiles
WHERE id = 'USER_UUID_FROM_STEP_2';
```

Should show:

- `plan`: `pro`
- `stripe_customer_id`: filled
- `stripe_subscription_id`: filled
- `current_period_end`: future date

**5. Verify in Stripe**

Check that Stripe customer has:

- Active subscription
- Same subscription ID as database
- Correct billing cycle

**6. Ask User to Confirm**

Have user:

1. Log out and log back in
2. Verify they see "Pro" plan in account
3. Confirm all their data is restored
4. Test creating new topic islands (should work without limits)

## OAuth "flow_state_not_found" Error

### What causes this?

This error appears when:

1. ⏱️ User takes too long during OAuth flow (>10 minutes)
2. 🍪 Browser cookies were cleared during OAuth
3. ⬅️➡️ User clicked back/forward during OAuth
4. 🔄 User refreshed page during OAuth

### Fix Applied

Updated `/app/auth/callback/route.ts` to:

- Detect this specific error code
- Log detailed debugging info
- Redirect user to login with helpful message: `/login?error=oauth_expired`
- Show user-friendly message: "Your login session expired. Please try again."

### How to Debug

Check server logs for:

```
[AUTH CALLBACK] Flow state not found - user may need to retry login
```

The log will include:

- Timestamp
- Error details
- Full URL for debugging

### Prevention

The error itself can't be fully prevented (it's a Supabase/Google OAuth timing issue), but:

- ✅ Users now see helpful error message instead of generic error
- ✅ Detailed logging helps track frequency
- ✅ Users know to simply try logging in again

## Refund/Cancellation Flow

### How It Works

1. **User initiates cancellation:**
   - Clicks "Manage Subscription" in app
   - Redirected to Stripe Customer Portal (`/api/stripe/portal`)

2. **User cancels in Stripe:**
   - Stripe Portal allows immediate or end-of-period cancellation
   - User can optionally provide feedback

3. **Stripe sends webhook:**
   - `customer.subscription.deleted` event sent to `/api/stripe/webhook`
   - Or `customer.subscription.updated` with status `canceled`

4. **Backend processes cancellation:**
   - Webhook resolves user by `stripe_customer_id`
   - Updates `profiles` table: `plan = 'free'`, clears subscription IDs
   - User immediately sees free tier limits

5. **Optional feedback:**
   - App can show cancellation feedback form
   - Data saved to `cancellation_feedback` table
   - Used for product improvements

### Webhook Event Flow

```typescript
// customer.subscription.updated (status: canceled or unpaid)
await clearSubscription(userId);
// Sets plan='free', clears subscription IDs

// customer.subscription.deleted
await clearSubscription(userId);
// Same as above
```

### Testing Cancellation

**Test in Stripe Test Mode:**

1. Create test subscription:

   ```bash
   # Use test card: 4242 4242 4242 4242
   # Any future expiry, any CVC
   ```

2. In Stripe Dashboard → Subscriptions:
   - Find test subscription
   - Click "Cancel subscription"
   - Choose "Cancel immediately"

3. Verify webhook fired:
   - Check webhook logs in Stripe Dashboard
   - Check your server logs for `[STRIPE WEBHOOK] Subscription deleted`

4. Verify in database:
   ```sql
   SELECT plan, stripe_subscription_id FROM profiles WHERE id = 'test_user_id';
   -- Should show: plan='free', stripe_subscription_id=null
   ```

### Refund Flow

For full refunds (customer paid but wants money back):

1. **In Stripe Dashboard:**
   - Go to Payments → Find payment
   - Click "Refund" → Enter amount
   - Add reason for refund

2. **Subscription handling:**
   - Refund automatically cancels subscription
   - Webhook fires: `customer.subscription.deleted`
   - User's plan automatically set to "free"

3. **Confirm with user:**
   - Check bank statement (refund takes 5-10 days)
   - Verify plan changed to free in app

## Preventing Future Issues

### For New Users

✅ All authentication paths now create BOTH profile tables:

- Google OAuth → Both tables created
- Email/password login → Both tables created
- Email verification → Both tables created

### For Existing Users

✅ Migration creates missing `profiles` entries:

- Backfills all existing users
- Sets default plan to "free"
- Preserves existing Stripe linkages

### For Stripe Integration

✅ Webhooks can now reliably find users:

- Users have `profiles` entries with `stripe_customer_id`
- Metadata includes `user_id` as backup
- Multiple fallback methods in `resolveUserId()`

### Monitoring

✅ Enhanced logging throughout:

- OAuth errors logged with context
- Stripe webhook events logged
- Subscription updates tracked
- Easier debugging of future issues

## Deployment Checklist

Before deploying these fixes:

- [ ] **Review migration file** - Ensure it's safe to run
- [ ] **Backup database** - Take snapshot before migration
- [ ] **Run migration** - Apply to production database
- [ ] **Deploy code changes** - Push updated auth callback and webhook handler
- [ ] **Test auth flow** - Create test account and verify both profile tables created
- [ ] **Test Stripe webhook** - Use Stripe test mode to trigger subscription events
- [ ] **Monitor logs** - Watch for OAuth and webhook errors
- [ ] **Manually recover affected users** - Use recovery steps above
- [ ] **Verify refund flow** - Test cancellation in test mode

## Support Response Template

When a user reports lost subscription:

> Hi [User],
>
> I apologize for the inconvenience. We recently updated our billing system and there was a synchronization issue that affected some accounts.
>
> Your subscription is still active in our payment processor, but it wasn't properly linked to your account. I've now manually reconnected your subscription, and you should have full access to all Pro features.
>
> Can you please:
>
> 1. Log out and log back in
> 2. Verify you see "Pro" in your account settings
> 3. Confirm all your data is restored
>
> If you still see any issues, please let me know immediately.
>
> Again, sorry for the disruption. Your subscription will continue as normal, and you won't be charged twice.
>
> Best regards,
> [Your name]

## Additional Notes

- **Data Safety**: User data (topic islands, flashcards, etc.) was never deleted - just inaccessible due to wrong plan tier
- **No Double Billing**: Users were not charged twice - subscription remained active in Stripe
- **Automatic Fix Going Forward**: With these changes, future users won't experience this issue
- **Quick Recovery**: Affected users can be restored in ~5 minutes once identified
