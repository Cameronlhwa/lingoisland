import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_subscription_id, stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json(
        { error: "No subscription found to sync" },
        { status: 404 }
      );
    }

    // Fetch subscription from Stripe
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(
      profile.stripe_subscription_id
    );

    const rawSub = subscription as any;

    // Get cancel status
    const cancelAtPeriodEnd = rawSub.cancel_at_period_end ?? false;
    const cancelAt = rawSub.cancel_at;
    const isCanceled =
      cancelAtPeriodEnd ||
      !!cancelAt ||
      rawSub.cancellation_details?.reason === "cancellation_requested";

    // Get current_period_end
    let currentPeriodEndUnix = rawSub.current_period_end;
    if (!currentPeriodEndUnix && rawSub.items?.data?.[0]) {
      currentPeriodEndUnix = rawSub.items.data[0].current_period_end;
    }
    if (!currentPeriodEndUnix && cancelAt) {
      currentPeriodEndUnix = cancelAt;
    }

    const periodEnd = currentPeriodEndUnix
      ? new Date(currentPeriodEndUnix * 1000)
      : null;

    // Calculate if user should be Pro
    const isPro =
      (subscription.status === "active" ||
        subscription.status === "trialing") &&
      periodEnd &&
      periodEnd.getTime() > Date.now();

    // Update database
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        plan: isPro ? "pro" : "free",
        stripe_customer_id:
          typeof subscription.customer === "string"
            ? subscription.customer
            : (subscription.customer as any)?.id ?? subscription.customer,
        stripe_subscription_id: subscription.id,
        current_period_end: periodEnd ? periodEnd.toISOString() : null,
        cancel_at_period_end: isCanceled,
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("[STRIPE SYNC] Failed to update profile:", updateError);
      return NextResponse.json(
        { error: "Failed to sync subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      plan: isPro ? "pro" : "free",
      current_period_end: periodEnd ? periodEnd.toISOString() : null,
      cancel_at_period_end: isCanceled,
    });
  } catch (error) {
    console.error("Error in POST /api/stripe/sync:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
