# How to Fix Lifetime Subscription Issue

## Quick Fix - Use the Sync Button

Once the deployment completes (check Vercel dashboard), follow these steps:

### Step 1: Wait for Deployment
1. Go to https://vercel.com
2. Wait for the deployment of commit "Add manual subscription sync from Stripe" to complete
3. Should take 2-3 minutes

### Step 2: Use the Sync Button
1. Log in as popcky12@gmail.com (or the affected user)
2. Open the Account modal (click on Account & Settings)
3. You should now see a **"Sync from Stripe"** button
4. Click it
5. Wait for the success message "Subscription synced successfully!"
6. The page will automatically reload your subscription data

That's it! Your subscription should now show the correct renewal date instead of "Lifetime access".

## What the Sync Button Does

The sync button:
1. Fetches your subscription ID from the database
2. Queries Stripe API for the latest subscription data
3. Updates your database with:
   - Correct `current_period_end` date
   - Current `cancel_at_period_end` status
   - Subscription status (active/canceled/etc.)
4. Reloads your entitlements automatically

## If It Still Shows Lifetime After Sync

This means either:
1. The subscription in Stripe doesn't have a `current_period_end` (shouldn't happen)
2. The subscription was actually canceled and deleted in Stripe

In that case:
1. Go to Stripe Dashboard → Customers → Search for the customer
2. Check if there's an active subscription
3. If yes, note the "Current period end" date
4. If the sync button doesn't fix it, let me know and we can investigate the Stripe API response

## For Future Issues

You can always use the "Sync from Stripe" button to:
- Fix subscription dates that got out of sync
- Update cancellation status
- Refresh subscription data after making changes in Stripe dashboard

The button will appear for any Pro user who has a `stripe_subscription_id` in the database.
