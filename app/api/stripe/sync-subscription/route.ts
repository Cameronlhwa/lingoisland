import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/stripe/sync-subscription
 * 
 * Manually sync subscription data from Stripe to the database.
 * Useful for fixing issues where webhook failed or data got out of sync.
 * 
 * This endpoint:
 * 1. Gets the user's stripe_subscription_id from the database
 * 2. Fetches the subscription from Stripe API
 * 3. Updates the database with the correct values
 * 4. Returns the updated subscription data
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's profile with subscription ID
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_subscription_id, stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[SYNC] Error fetching profile:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 }
      );
    }

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json(
        { 
          error: "No active subscription found",
          message: "This account does not have a Stripe subscription to sync."
        },
        { status: 404 }
      );
    }

    // Fetch subscription from Stripe
    const stripe = getStripe();
    let subscription;
    
    try {
      subscription = await stripe.subscriptions.retrieve(
        profile.stripe_subscription_id
      );
    } catch (stripeError: any) {
      console.error("[SYNC] Error fetching from Stripe:", stripeError);
      return NextResponse.json(
        { 
          error: "Failed to fetch subscription from Stripe",
          message: stripeError.message || "Unknown Stripe error"
        },
        { status: 500 }
      );
    }

    // Parse the subscription data
    const stripeCustomerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;

    const currentPeriodEndUnix = subscription.current_period_end;
    const currentPeriodEnd =
      typeof currentPeriodEndUnix === "number"
        ? new Date(currentPeriodEndUnix * 1000).toISOString()
        : null;

    console.log("[SYNC] Syncing subscription for user:", user.id, {
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });

    // Determine plan based on subscription status
    let plan: "free" | "pro" = "free";
    let shouldClearSubscription = false;

    if (subscription.status === "active" || subscription.status === "trialing") {
      plan = "pro";
    } else if (subscription.status === "canceled") {
      // If canceled but still in current period, keep pro
      if (subscription.cancel_at_period_end && currentPeriodEnd) {
        const periodEnd = new Date(currentPeriodEnd);
        if (periodEnd.getTime() > Date.now()) {
          plan = "pro";
        } else {
          shouldClearSubscription = true;
        }
      } else {
        shouldClearSubscription = true;
      }
    } else if (
      subscription.status === "unpaid" ||
      subscription.status === "incomplete" ||
      subscription.status === "incomplete_expired" ||
      subscription.status === "past_due"
    ) {
      shouldClearSubscription = true;
    }

    // Update the database
    if (shouldClearSubscription) {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          plan: "free",
          stripe_subscription_id: null,
          current_period_end: null,
          cancel_at_period_end: false,
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("[SYNC] Error clearing subscription:", updateError);
        return NextResponse.json(
          { error: "Failed to update database" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Subscription cleared - subscription is no longer active",
        subscription: {
          status: subscription.status,
          plan: "free",
        },
      });
    } else {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          plan,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: subscription.id,
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: subscription.cancel_at_period_end || false,
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("[SYNC] Error updating subscription:", updateError);
        return NextResponse.json(
          { error: "Failed to update database" },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Subscription synced successfully",
        subscription: {
          status: subscription.status,
          plan,
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: subscription.cancel_at_period_end || false,
        },
      });
    }
  } catch (error) {
    console.error("[SYNC] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
