import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

let supabaseAdmin: SupabaseClient | null = null;

const getSupabaseAdmin = () => {
  if (supabaseAdmin) return supabaseAdmin;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin env vars are not set");
  }
  supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return supabaseAdmin;
};

const findProfileUserId = async (stripeCustomerId: string | null) => {
  if (!stripeCustomerId) return null;
  const { data, error } = await getSupabaseAdmin()
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
  
  // Stripe Subscription.current_period_end is a Unix timestamp (number)
  const currentPeriodEndUnix = subscription.current_period_end;
  const currentPeriodEnd =
    typeof currentPeriodEndUnix === "number"
      ? new Date(currentPeriodEndUnix * 1000).toISOString()
      : null;

  console.log("[STRIPE WEBHOOK] Upserting subscription for user:", userId, {
    stripeCustomerId,
    subscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEndUnix,
    currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  if (!currentPeriodEnd) {
    console.error("[STRIPE WEBHOOK] WARNING: current_period_end is missing from subscription!");
    console.error("[STRIPE WEBHOOK] Full subscription object:", JSON.stringify(subscription, null, 2));
  }

  const { error } = await getSupabaseAdmin().from("profiles").upsert(
    {
      id: userId,
      plan: "pro",
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error(
      "[STRIPE WEBHOOK] Failed to upsert subscription:",
      error
    );
  } else {
    console.log("[STRIPE WEBHOOK] Successfully upserted subscription for user:", userId);
  }
};

const clearSubscription = async (userId: string) => {
  console.log("[STRIPE WEBHOOK] Clearing subscription for user:", userId);
  const { error } = await getSupabaseAdmin()
    .from("profiles")
    .update({
      plan: "free",
      stripe_subscription_id: null,
      current_period_end: null,
      cancel_at_period_end: false,
    })
    .eq("id", userId);

  if (error) {
    console.error("[STRIPE WEBHOOK] Failed to clear subscription:", error);
  } else {
    console.log("[STRIPE WEBHOOK] Successfully cleared subscription for user:", userId);
  }
};

const resolveUserId = async (
  subscription?: Stripe.Subscription | null,
  session?: Stripe.Checkout.Session | null
) => {
  // Try 1: Get from subscription metadata
  const metadataUserId = subscription?.metadata?.user_id ?? null;
  if (metadataUserId) {
    console.log("[STRIPE WEBHOOK] Resolved user ID from subscription metadata:", metadataUserId);
    return metadataUserId;
  }

  // Try 2: Get from session client_reference_id
  const sessionUserId = session?.client_reference_id ?? null;
  if (sessionUserId) {
    console.log("[STRIPE WEBHOOK] Resolved user ID from session client_reference_id:", sessionUserId);
    return sessionUserId;
  }

  // Try 3: Look up by stripe_customer_id
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

  if (stripeCustomerId) {
    console.log("[STRIPE WEBHOOK] Looking up user by stripe_customer_id:", stripeCustomerId);
    const userId = await findProfileUserId(stripeCustomerId);
    if (userId) {
      console.log("[STRIPE WEBHOOK] Resolved user ID from stripe_customer_id lookup:", userId);
    } else {
      console.error("[STRIPE WEBHOOK] Could not find user with stripe_customer_id:", stripeCustomerId);
    }
    return userId;
  }

  console.error("[STRIPE WEBHOOK] Failed to resolve user ID - no metadata, client_reference_id, or customer_id available");
  return null;
};

export async function POST(request: Request) {
  const stripe = getStripe();
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
        console.log("[STRIPE WEBHOOK] Processing checkout.session.completed");
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("[STRIPE WEBHOOK] Session data:", {
          sessionId: session.id,
          customerId: session.customer,
          subscriptionId: session.subscription,
          clientReferenceId: session.client_reference_id,
        });

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (!subscriptionId) {
          console.warn("[STRIPE WEBHOOK] Missing subscription on session - this might be a one-time payment, not a subscription");
          break;
        }

        console.log("[STRIPE WEBHOOK] Retrieving subscription:", subscriptionId);
        const subscription = await stripe.subscriptions.retrieve(
          subscriptionId
        );
        console.log("[STRIPE WEBHOOK] Retrieved subscription:", {
          id: subscription.id,
          status: subscription.status,
          customerId: subscription.customer,
          metadata: subscription.metadata,
        });

        const userId = await resolveUserId(subscription, session);

        if (!userId) {
          console.error("[STRIPE WEBHOOK] Could not resolve user for checkout. Session:", {
            sessionId: session.id,
            customerId: session.customer,
            subscriptionId: subscription.id,
            clientReferenceId: session.client_reference_id,
            metadata: subscription.metadata,
          });
          break;
        }

        console.log("[STRIPE WEBHOOK] Resolved user ID:", userId);
        await upsertActiveSubscription(userId, subscription);
        break;
      }
      case "customer.subscription.updated": {
        console.log("[STRIPE WEBHOOK] Processing customer.subscription.updated");
        const subscription = event.data.object as Stripe.Subscription;
        console.log("[STRIPE WEBHOOK] Subscription data:", {
          id: subscription.id,
          status: subscription.status,
          customerId: subscription.customer,
          metadata: subscription.metadata,
        });

        const userId = await resolveUserId(subscription, null);

        if (!userId) {
          console.error("[STRIPE WEBHOOK] Could not resolve user for update. Subscription:", {
            subscriptionId: subscription.id,
            customerId: subscription.customer,
            metadata: subscription.metadata,
          });
          break;
        }

        console.log("[STRIPE WEBHOOK] Subscription updated:", {
          userId,
          subscriptionId: subscription.id,
          status: subscription.status,
        });

        if (subscription.status === "active" || subscription.status === "trialing") {
          console.log("[STRIPE WEBHOOK] Subscription is active/trialing - upgrading to Pro");
          await upsertActiveSubscription(userId, subscription);
        } else if (subscription.status === "canceled") {
          // Check if cancel_at_period_end is true
          // If true, user keeps access until current_period_end
          if (subscription.cancel_at_period_end) {
            console.log("[STRIPE WEBHOOK] Subscription canceled at period end - maintaining Pro until", subscription.current_period_end);
            // Keep them as Pro until the period ends
            await upsertActiveSubscription(userId, subscription);
          } else {
            console.log("[STRIPE WEBHOOK] Subscription canceled immediately - downgrading to Free");
            await clearSubscription(userId);
          }
        } else if (subscription.status === "unpaid") {
          console.log("[STRIPE WEBHOOK] Subscription is unpaid - downgrading to Free");
          await clearSubscription(userId);
        } else {
          console.log("[STRIPE WEBHOOK] Subscription status not handled:", subscription.status);
        }
        break;
      }
      case "customer.subscription.deleted": {
        console.log("[STRIPE WEBHOOK] Processing customer.subscription.deleted");
        const subscription = event.data.object as Stripe.Subscription;
        console.log("[STRIPE WEBHOOK] Subscription data:", {
          id: subscription.id,
          customerId: subscription.customer,
          metadata: subscription.metadata,
        });

        const userId = await resolveUserId(subscription, null);

        if (!userId) {
          console.error("[STRIPE WEBHOOK] Could not resolve user for delete. Subscription:", {
            subscriptionId: subscription.id,
            customerId: subscription.customer,
            metadata: subscription.metadata,
          });
          break;
        }

        console.log("[STRIPE WEBHOOK] Subscription deleted:", {
          userId,
          subscriptionId: subscription.id,
        });

        await clearSubscription(userId);
        break;
      }
      default:
        console.log("[STRIPE WEBHOOK] Unhandled event type:", event.type);
        break;
    }
  } catch (error) {
    console.error("[STRIPE WEBHOOK] Handler failed:", error);
    console.error("[STRIPE WEBHOOK] Event data:", JSON.stringify(event, null, 2));
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
