import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
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
      .select("stripe_subscription_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.stripe_subscription_id) {
      return NextResponse.json({ 
        cancelAtPeriodEnd: false,
        message: "No active subscription"
      });
    }

    // Check Stripe for cancellation status
    try {
      const stripe = getStripe();
      const subscription = await stripe.subscriptions.retrieve(
        profile.stripe_subscription_id
      );

      const rawSub = subscription as any;
      
      // Get cancel status
      const cancelAtPeriodEnd = rawSub.cancel_at_period_end ?? false;
      const cancelAt = rawSub.cancel_at;
      const isCanceled = cancelAtPeriodEnd || !!cancelAt || rawSub.cancellation_details?.reason === 'cancellation_requested';
      
      // Get current_period_end
      let currentPeriodEndUnix = rawSub.current_period_end;
      if (!currentPeriodEndUnix && rawSub.items?.data?.[0]) {
        currentPeriodEndUnix = rawSub.items.data[0].current_period_end;
      }
      if (!currentPeriodEndUnix && cancelAt) {
        currentPeriodEndUnix = cancelAt;
      }

      return NextResponse.json({
        cancelAtPeriodEnd: isCanceled,
        currentPeriodEnd: currentPeriodEndUnix 
          ? new Date(currentPeriodEndUnix * 1000).toISOString()
          : null,
      });
    } catch (stripeError) {
      console.error("[SUBSCRIPTION STATUS] Failed to fetch from Stripe:", stripeError);
      // If Stripe call fails, assume not canceled
      return NextResponse.json({ 
        cancelAtPeriodEnd: false,
        message: "Could not check Stripe status"
      });
    }
  } catch (error) {
    console.error("Error in GET /api/subscription-status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
