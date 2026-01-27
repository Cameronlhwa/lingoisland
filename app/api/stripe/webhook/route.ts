import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const findProfileUserId = async (stripeCustomerId: string | null) => {
  if (!stripeCustomerId) return null;
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle();

  if (error) {
    console.error("[STRIPE WEBHOOK] Failed to lookup customer:", error);
    return null;
  }

  return data?.id ?? null;
};

const upsertActiveSubscription = async (
  userId: string,
  subscription: Stripe.Subscription
) => {
  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const currentPeriodEndUnix =
    (subscription as { current_period_end?: number | null }).current_period_end ??
    null;
  const currentPeriodEnd =
    typeof currentPeriodEndUnix === "number"
      ? new Date(currentPeriodEndUnix * 1000).toISOString()
      : null;

  const { error } = await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      plan: "pro",
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
      current_period_end: currentPeriodEnd,
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error(
      "[STRIPE WEBHOOK] Failed to upsert subscription:",
      error
    );
  }
};

const clearSubscription = async (userId: string) => {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      plan: "free",
      stripe_subscription_id: null,
      current_period_end: null,
    })
    .eq("id", userId);

  if (error) {
    console.error("[STRIPE WEBHOOK] Failed to clear subscription:", error);
  }
};

const resolveUserId = async (
  subscription?: Stripe.Subscription | null,
  session?: Stripe.Checkout.Session | null
) => {
  const metadataUserId = subscription?.metadata?.user_id ?? null;
  if (metadataUserId) return metadataUserId;

  const sessionUserId = session?.client_reference_id ?? null;
  if (sessionUserId) return sessionUserId;

  const stripeCustomerId =
    (subscription?.customer &&
      (typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id)) ||
    (session?.customer &&
      (typeof session.customer === "string"
        ? session.customer
        : session.customer.id)) ||
    null;

  return findProfileUserId(stripeCustomerId);
};

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    );
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("[STRIPE WEBHOOK] Signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (!subscriptionId) {
          console.warn("[STRIPE WEBHOOK] Missing subscription on session");
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId
        );
        const userId = await resolveUserId(subscription, session);

        if (!userId) {
          console.warn("[STRIPE WEBHOOK] Could not resolve user for checkout");
          break;
        }

        await upsertActiveSubscription(userId, subscription);
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(subscription, null);

        if (!userId) {
          console.warn("[STRIPE WEBHOOK] Could not resolve user for update");
          break;
        }

        if (subscription.status === "active" || subscription.status === "trialing") {
          await upsertActiveSubscription(userId, subscription);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(subscription, null);

        if (!userId) {
          console.warn("[STRIPE WEBHOOK] Could not resolve user for delete");
          break;
        }

        await clearSubscription(userId);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error("[STRIPE WEBHOOK] Handler failed:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
