import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { reconcileUserSubscription } from "@/lib/stripe/reconcileUserSubscription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Attach an existing Stripe Pro subscription (looked up by email / customer id)
 * to the currently signed-in user. Safe to call after Google OAuth / login.
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

    const result = await reconcileUserSubscription({
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json({
      success: true,
      plan: result.plan,
      reconciled: result.reconciled,
    });
  } catch (error) {
    console.error("[STRIPE RECONCILE API]", error);
    return NextResponse.json(
      { error: "Failed to reconcile subscription" },
      { status: 500 },
    );
  }
}
