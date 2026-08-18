import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckoutRequest = {
  interval: "monthly" | "yearly";
  cancelContext?: "onboarding" | "pricing";
  islandId?: string;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn("[STRIPE CHECKOUT] Unauthorized", authError);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.is_anonymous) {
      return NextResponse.json(
        { error: "Account required before checkout" },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => null)) as
      | CheckoutRequest
      | null;
    const interval = body?.interval;
    const cancelContext = body?.cancelContext ?? "pricing";
    const rawIslandId = typeof body?.islandId === "string" ? body.islandId : "";
    const islandId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      rawIslandId,
    )
      ? rawIslandId
      : undefined;

    if (interval !== "monthly" && interval !== "yearly") {
      console.warn("[STRIPE CHECKOUT] Invalid interval", interval);
      return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
    }

    const priceId =
      interval === "monthly"
        ? process.env.STRIPE_PRICE_PRO_MONTHLY
        : process.env.STRIPE_PRICE_PRO_YEARLY;

    if (!priceId) {
      console.error("[STRIPE CHECKOUT] Missing price ID for", interval);
      return NextResponse.json(
        { error: "Stripe price not configured" },
        { status: 500 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[STRIPE CHECKOUT] Failed to load profile:", profileError);
      return NextResponse.json(
        { error: "Failed to load profile" },
        { status: 500 }
      );
    }

    let stripeCustomerId = profile?.stripe_customer_id ?? null;
    const stripe = getStripe();

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      stripeCustomerId = customer.id;

      const { error: upsertError } = await supabase
        .from("profiles")
        .upsert(
          { id: user.id, stripe_customer_id: stripeCustomerId },
          { onConflict: "id" }
        );

      if (upsertError) {
        console.error(
          "[STRIPE CHECKOUT] Failed to store customer ID:",
          upsertError
        );
        return NextResponse.json(
          { error: "Failed to save customer" },
          { status: 500 }
        );
      }
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const cancelUrl =
      cancelContext === "onboarding" && islandId
        ? `${siteUrl}/onboarding/upgrade?canceled=1&islandId=${encodeURIComponent(islandId)}&plan=${interval}`
        : `${siteUrl}/pricing`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan: interval,
        },
      },
      metadata: {
        user_id: user.id,
        plan: interval,
        cancel_context: cancelContext,
        ...(islandId ? { island_id: islandId } : {}),
      },
      success_url: `${siteUrl}/app?checkout=success`,
      cancel_url: cancelUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Error in POST /api/stripe/checkout:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
