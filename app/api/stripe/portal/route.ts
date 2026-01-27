import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[STRIPE PORTAL] Failed to load profile:", profileError);
      return NextResponse.json(
        { error: "Failed to load profile" },
        { status: 500 }
      );
    }

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No billing customer found" },
        { status: 400 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_SITE_URL}/app`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error in POST /api/stripe/portal:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
