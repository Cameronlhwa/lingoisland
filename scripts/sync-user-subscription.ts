/**
 * Script to manually sync a user's subscription from Stripe
 * Run this with: npx tsx scripts/sync-user-subscription.ts <email>
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

// Load environment variables
config({ path: ".env.local" });

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function syncUserSubscription(email: string) {
  console.log(`\n🔍 Looking up user: ${email}`);

  // Get user ID from auth.users first
  const { data: authUser, error: authError } = await supabase.auth.admin.listUsers();
  
  if (authError) {
    console.error("❌ Failed to list auth users:", authError);
    return;
  }

  const user = authUser.users.find(u => u.email === email);
  if (!user) {
    console.error(`❌ User with email ${email} not found`);
    return;
  }

  console.log("✅ Found user ID:", user.id);

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    console.error("❌ Failed to find user profile:", profileError);
    return;
  }

  console.log("\n📊 Current database state:");
  console.log("  Plan:", profile.plan);
  console.log("  Stripe Customer ID:", profile.stripe_customer_id);
  console.log("  Stripe Subscription ID:", profile.stripe_subscription_id);
  console.log("  Current Period End:", profile.current_period_end);
  console.log("  Cancel at Period End:", profile.cancel_at_period_end);

  // Try to find subscription by customer ID if no subscription ID is stored
  let subscriptionId = profile.stripe_subscription_id;
  
  if (!subscriptionId && profile.stripe_customer_id) {
    console.log("\n🔍 No subscription ID in database, searching by customer ID...");
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        limit: 10,
      });
      
      if (subscriptions.data.length > 0) {
        // Find the most recent active or trialing subscription
        const activeSubscription = subscriptions.data.find(
          s => s.status === "active" || s.status === "trialing"
        );
        
        if (activeSubscription) {
          subscriptionId = activeSubscription.id;
          console.log("✅ Found active subscription:", subscriptionId);
        } else {
          // Just take the most recent one
          subscriptionId = subscriptions.data[0].id;
          console.log("ℹ️  Found subscription (not active):", subscriptionId);
        }
      }
    } catch (error) {
      console.error("⚠️  Failed to search for subscriptions:", error);
    }
  }

  if (!subscriptionId) {
    console.log("\n⚠️  No subscription found for this customer.");
    return;
  }

  try {
    console.log("\n🔄 Fetching subscription from Stripe...");
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['customer']
    });

    console.log("\n📋 Stripe subscription data:");
    console.log("  ID:", subscription.id);
    console.log("  Status:", subscription.status);
    
    // Access properties - they might be on subscription or subscription.items
    const rawSub = subscription as any;
    
    // Check if subscription is canceled - either cancel_at_period_end OR cancel_at is set
    const cancelAtPeriodEnd = rawSub.cancel_at_period_end ?? false;
    const cancelAt = rawSub.cancel_at; // Unix timestamp when subscription will end
    const isCanceled = cancelAtPeriodEnd || !!cancelAt || rawSub.cancellation_details?.reason === 'cancellation_requested';
    
    // Get current_period_end - might be on subscription or in items
    let currentPeriodEndUnix = rawSub.current_period_end;
    
    // If not on subscription object, check the first subscription item
    if (!currentPeriodEndUnix && rawSub.items?.data?.[0]) {
      currentPeriodEndUnix = rawSub.items.data[0].current_period_end;
    }
    
    // Fallback to cancel_at if current_period_end is not available
    if (!currentPeriodEndUnix && cancelAt) {
      currentPeriodEndUnix = cancelAt;
    }
    
    console.log("  Is Canceled:", isCanceled);
    console.log("  Cancel at Period End:", cancelAtPeriodEnd);
    console.log("  Cancel At (Unix):", cancelAt);
    console.log("  Current Period End (Unix):", currentPeriodEndUnix);
    
    const periodEnd = currentPeriodEndUnix 
      ? new Date(currentPeriodEndUnix * 1000)
      : null;
    console.log("  Current Period End (Date):", periodEnd?.toISOString());

    // Calculate if user should be Pro
    const isPro = 
      (subscription.status === "active" || subscription.status === "trialing") &&
      periodEnd &&
      periodEnd.getTime() > Date.now();

    console.log("\n✨ Calculated Pro status:", isPro);
    console.log("  Reason:", isPro ? "Active subscription with future period end" : "Subscription not active or period ended");

    // Update database
    console.log("\n💾 Updating database...");
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        plan: isPro ? "pro" : "free",
        stripe_customer_id: typeof subscription.customer === "string" 
          ? subscription.customer 
          : (subscription.customer as any)?.id ?? subscription.customer,
        stripe_subscription_id: subscription.id,
        current_period_end: periodEnd ? periodEnd.toISOString() : null,
        cancel_at_period_end: isCanceled, // Use our calculated canceled status
      })
      .eq("id", profile.id);

    if (updateError) {
      console.error("❌ Failed to update profile:", updateError);
      return;
    }

    console.log("\n✅ Successfully synced subscription!");
    console.log("\n📊 New database state:");
    console.log("  Plan:", isPro ? "pro" : "free");
    console.log("  Current Period End:", periodEnd?.toISOString());
    console.log("  Cancel at Period End (saved to DB):", isCanceled);
  } catch (error: any) {
    if (error.code === "resource_missing") {
      console.error("\n❌ Subscription not found in Stripe. It may have been deleted.");
      console.log("\n🔧 Clearing subscription data from database...");
      
      const { error: clearError } = await supabase
        .from("profiles")
        .update({
          plan: "free",
          stripe_subscription_id: null,
          current_period_end: null,
          cancel_at_period_end: false,
        })
        .eq("id", profile.id);

      if (clearError) {
        console.error("❌ Failed to clear subscription:", clearError);
      } else {
        console.log("✅ Successfully cleared subscription data");
      }
    } else {
      console.error("\n❌ Failed to fetch subscription from Stripe:", error);
    }
  }
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/sync-user-subscription.ts <email>");
  process.exit(1);
}

syncUserSubscription(email).then(() => {
  console.log("\n✅ Done!");
  process.exit(0);
});
