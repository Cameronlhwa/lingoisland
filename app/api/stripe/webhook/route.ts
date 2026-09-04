import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { captureServerEvent } from "@/lib/posthog/server";
import {
  grantProduct,
  revokeProduct,
  type BillableProduct,
} from "@/lib/product-plans";

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

const resolveBillableProduct = (
  subscription?: Stripe.Subscription | null,
  session?: Stripe.Checkout.Session | null,
): BillableProduct => {
  const raw =
    subscription?.metadata?.product ?? session?.metadata?.product ?? "core";
  if (raw === "hsk") return "hsk";
  const priceId = subscription?.items.data[0]?.price.id;
  const hskPriceIds = [
    process.env.STRIPE_PRICE_HSK_MONTHLY,
    process.env.STRIPE_PRICE_HSK_ANNUAL,
    process.env.STRIPE_PRICE_HSK_YEARLY,
  ];
  return priceId && hskPriceIds.includes(priceId) ? "hsk" : "core";
};

const upsertProductSubscription = async (
  userId: string,
  product: BillableProduct,
  subscription: Stripe.Subscription,
  currentPeriodEnd: string | null,
  cancelAtPeriodEnd: boolean,
) => {
  const { error } = await getSupabaseAdmin()
    .from("product_subscriptions")
    .upsert(
      {
        user_id: userId,
        product,
        stripe_subscription_id: subscription.id,
        status: subscription.status === "trialing" ? "trialing" : "active",
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,product" },
    );
  if (error) {
    // Compatibility fallback: legacy profiles.plan remains authoritative until
    // the product_subscriptions migration has been applied.
    console.warn("[STRIPE WEBHOOK] Product subscription upsert skipped:", error);
  }
};

const upsertActiveSubscription = async (
  userId: string,
  subscription: Stripe.Subscription,
  product: BillableProduct = "core",
) => {
  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  
  // Stripe subscription properties - need to handle different API versions
  const rawSub = subscription as any;
  
  // Get cancel status - either cancel_at_period_end OR cancel_at is set
  const cancelAtPeriodEnd = rawSub.cancel_at_period_end ?? false;
  const cancelAt = rawSub.cancel_at;
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
  
  const currentPeriodEnd =
    typeof currentPeriodEndUnix === "number"
      ? new Date(currentPeriodEndUnix * 1000).toISOString()
      : null;

  console.log("[STRIPE WEBHOOK] Upserting subscription for user:", userId, {
    stripeCustomerId,
    subscriptionId: subscription.id,
    status: subscription.status,
    product,
    currentPeriodEndUnix,
    currentPeriodEnd,
    cancelAtPeriodEnd: isCanceled,
    cancelAt,
  });

  if (!currentPeriodEnd) {
    console.error("[STRIPE WEBHOOK] WARNING: current_period_end is missing from subscription!");
    console.error("[STRIPE WEBHOOK] Full subscription object:", JSON.stringify(subscription, null, 2));
  }

  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();

  const nextPlan = grantProduct(existing?.plan, product);
  await upsertProductSubscription(
    userId,
    product,
    subscription,
    currentPeriodEnd,
    isCanceled,
  );

  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      plan: nextPlan,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: subscription.id,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: isCanceled,
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error(
      "[STRIPE WEBHOOK] Failed to upsert subscription:",
      error
    );
  } else {
    console.log(
      "[STRIPE WEBHOOK] Successfully upserted subscription for user:",
      userId,
      "plan:",
      nextPlan,
    );
  }
};

/**
 * Safety net: product_track='hsk' is normally already set on user_profiles by
 * the HSK journey-generation step (pre-payment), but stamp it again here in
 * case that write didn't happen for this user (e.g. they reached checkout via
 * some other path). Billing state itself lives on `profiles`, not
 * `user_profiles` — this only affects which in-app dashboard they land on.
 */
const stampHskProductTrack = async (userId: string) => {
  const { error } = await getSupabaseAdmin()
    .from("user_profiles")
    .upsert({ user_id: userId, product_track: "hsk" }, { onConflict: "user_id" });
  if (error) {
    console.warn("[STRIPE WEBHOOK] Failed to stamp product_track=hsk:", error);
  }
};

const clearSubscription = async (
  userId: string,
  product: BillableProduct = "core",
) => {
  console.log("[STRIPE WEBHOOK] Clearing subscription for user:", userId, {
    product,
  });
  const admin = getSupabaseAdmin();
  const { data: existing } = await admin
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .maybeSingle();

  const nextPlan = revokeProduct(existing?.plan, product);
  const clearingLastProduct = nextPlan === "free";
  const { error: subscriptionError } = await admin
    .from("product_subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("product", product);
  if (subscriptionError) {
    console.warn(
      "[STRIPE WEBHOOK] Product subscription revoke skipped:",
      subscriptionError,
    );
  }

  const { error } = await admin
    .from("profiles")
    .update({
      plan: nextPlan,
      ...(clearingLastProduct
        ? {
            stripe_subscription_id: null,
            current_period_end: null,
            cancel_at_period_end: false,
          }
        : {}),
    })
    .eq("id", userId);

  if (error) {
    console.error("[STRIPE WEBHOOK] Failed to clear subscription:", error);
  } else {
    console.log(
      "[STRIPE WEBHOOK] Successfully cleared subscription for user:",
      userId,
      "plan:",
      nextPlan,
    );
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
          console.error("[STRIPE WEBHOOK] Missing subscription on checkout session:", session.id);
          return NextResponse.json(
            { error: "Missing subscription on checkout session" },
            { status: 400 },
          );
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
          // Return an error so Stripe retries rather than leaving a completed
          // checkout without its corresponding entitlement.
          return NextResponse.json(
            { error: "Could not resolve user ID for checkout" },
            { status: 400 },
          );
        }

        console.log("[STRIPE WEBHOOK] Resolved user ID:", userId);
        const product = resolveBillableProduct(subscription, session);
        await upsertActiveSubscription(userId, subscription, product);

        if (product === "hsk") {
          await stampHskProductTrack(userId);
        } else {
          // Core subscribers entering from public onboarding do not yet have a
          // generated journey. Mark setup complete so `/app` stays the post-pay
          // destination instead of redirecting them into journey creation.
          const { error: onboardingError } = await getSupabaseAdmin()
            .from("profiles")
            .update({ onboarding_complete: true })
            .eq("id", userId);
          if (onboardingError) {
            console.error(
              "[STRIPE WEBHOOK] Failed to mark core onboarding complete:",
              onboardingError,
            );
          }
        }

        // Track checkout completion in PostHog
        const interval = subscription.items.data[0]?.price?.recurring?.interval ?? "unknown";
        captureServerEvent({
          distinctId: userId,
          event: "checkout_completed",
          properties: {
            subscription_id: subscription.id,
            interval,
            amount: session.amount_total ? session.amount_total / 100 : undefined,
            currency: session.currency ?? undefined,
          },
        }).catch(() => {});

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
          const rawSub = subscription as any;
          console.error("[STRIPE WEBHOOK] ⚠️  CRITICAL: Could not resolve user for update. Subscription:", {
            subscriptionId: subscription.id,
            customerId: subscription.customer,
            metadata: subscription.metadata,
            status: subscription.status,
            cancelAtPeriodEnd: rawSub.cancel_at_period_end ?? false,
            cancelAt: rawSub.cancel_at,
          });
          console.error("[STRIPE WEBHOOK] ⚠️  Subscription status change will not be applied!");
          // Return error so Stripe will retry
          return NextResponse.json(
            { error: "Could not resolve user ID for subscription update" },
            { status: 400 }
          );
        }

        console.log("[STRIPE WEBHOOK] Subscription updated:", {
          userId,
          subscriptionId: subscription.id,
          status: subscription.status,
        });

        const product = resolveBillableProduct(subscription, null);

        if (subscription.status === "active" || subscription.status === "trialing") {
          console.log("[STRIPE WEBHOOK] Subscription is active/trialing - upgrading plan");
          await upsertActiveSubscription(userId, subscription, product);
        } else if (subscription.status === "canceled") {
          // Check if subscription has cancel_at set or cancellation_details
          const rawSub = subscription as any;
          const cancelAtPeriodEnd = rawSub.cancel_at_period_end ?? false;
          const cancelAt = rawSub.cancel_at;
          const isCanceled = cancelAtPeriodEnd || !!cancelAt || rawSub.cancellation_details?.reason === 'cancellation_requested';
          
          // If subscription is canceled but user should keep access until period end
          if (isCanceled) {
            let periodEnd = rawSub.current_period_end;
            if (!periodEnd && rawSub.items?.data?.[0]) {
              periodEnd = rawSub.items.data[0].current_period_end;
            }
            if (!periodEnd && cancelAt) {
              periodEnd = cancelAt;
            }
            
            console.log("[STRIPE WEBHOOK] Subscription canceled at period end - maintaining access until", periodEnd);
            // Keep them as Pro until the period ends
            await upsertActiveSubscription(userId, subscription, product);
          } else {
            console.log("[STRIPE WEBHOOK] Subscription canceled immediately - revoking product", product);
            await clearSubscription(userId, product);
          }
        } else if (subscription.status === "unpaid") {
          console.log("[STRIPE WEBHOOK] Subscription is unpaid - revoking product", product);
          await clearSubscription(userId, product);
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
          console.error("[STRIPE WEBHOOK] ⚠️  CRITICAL: Could not resolve user for delete. Subscription:", {
            subscriptionId: subscription.id,
            customerId: subscription.customer,
            metadata: subscription.metadata,
          });
          console.error("[STRIPE WEBHOOK] ⚠️  User will remain Pro even though subscription was deleted!");
          console.error("[STRIPE WEBHOOK] ⚠️  Manual intervention required - find user by stripe_customer_id and clear subscription");
          // Return error so Stripe will retry
          return NextResponse.json(
            { error: "Could not resolve user ID for subscription deletion" },
            { status: 400 }
          );
        }

        console.log("[STRIPE WEBHOOK] Subscription deleted:", {
          userId,
          subscriptionId: subscription.id,
        });

        const product = resolveBillableProduct(subscription, null);
        await clearSubscription(userId, product);
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
