import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import {
  grantProduct,
  parseProductPlan,
  type BillableProduct,
  type ProductPlan,
} from "@/lib/product-plans";

let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdmin) return supabaseAdmin;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase admin env vars are not set");
  }
  supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseAdmin;
}

function isActiveSubscription(sub: {
  status: string;
  current_period_end?: number | null;
  items?: { data?: Array<{ current_period_end?: number }> };
  cancel_at?: number | null;
  metadata?: Record<string, string> | null;
}): { active: boolean; periodEnd: Date | null; product: BillableProduct } {
  const raw = sub as {
    status: string;
    current_period_end?: number;
    cancel_at?: number;
    items?: { data?: Array<{ current_period_end?: number }> };
    metadata?: Record<string, string> | null;
  };
  let endUnix = raw.current_period_end;
  if (!endUnix && raw.items?.data?.[0]?.current_period_end) {
    endUnix = raw.items.data[0].current_period_end;
  }
  if (!endUnix && raw.cancel_at) endUnix = raw.cancel_at;
  const periodEnd = endUnix ? new Date(endUnix * 1000) : null;
  const statusOk = raw.status === "active" || raw.status === "trialing";
  const active = statusOk && (!periodEnd || periodEnd.getTime() > Date.now());
  const product: BillableProduct =
    raw.metadata?.product === "hsk" ? "hsk" : "core";
  return { active, periodEnd, product };
}

function resolvePriceProduct(priceId: string | undefined | null): BillableProduct {
  if (!priceId) return "core";
  const hskPrices = [
    process.env.STRIPE_PRICE_HSK_MONTHLY,
    process.env.STRIPE_PRICE_HSK_ANNUAL,
    process.env.STRIPE_PRICE_HSK_YEARLY,
  ].filter(Boolean);
  return hskPrices.includes(priceId) ? "hsk" : "core";
}

/**
 * If the signed-in user is free but Stripe has an active subscription for their
 * email (or a customer id already on their profile), attach Pro to this user id.
 *
 * Fixes the common split where Google OAuth lands on a profiles row that was
 * never linked to the Stripe customer created under the same email.
 */
export async function reconcileUserSubscription(opts: {
  userId: string;
  email?: string | null;
}): Promise<{ plan: ProductPlan; reconciled: boolean }> {
  const { userId, email } = opts;
  const admin = getSupabaseAdmin();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, plan, stripe_customer_id, stripe_subscription_id, current_period_end")
    .eq("id", userId)
    .maybeSingle();

  const currentPlan = parseProductPlan(profile?.plan);

  const stripe = getStripe();
  let customerId = profile?.stripe_customer_id ?? null;
  let subscriptionId = profile?.stripe_subscription_id ?? null;
  let periodEnd: Date | null = null;
  let foundActive = false;
  let product: BillableProduct = "core";

  // 1) Existing subscription id on profile
  if (subscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const check = isActiveSubscription(sub);
      if (check.active) {
        foundActive = true;
        periodEnd = check.periodEnd;
        product =
          check.product !== "core"
            ? check.product
            : resolvePriceProduct(sub.items.data[0]?.price?.id);
        customerId =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      }
    } catch (err) {
      console.warn("[STRIPE RECONCILE] subscription retrieve failed", err);
    }
  }

  // 2) List subs for known customer
  if (!foundActive && customerId) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
      });
      const active = subs.data.find((s) => isActiveSubscription(s).active);
      if (active) {
        const check = isActiveSubscription(active);
        foundActive = true;
        subscriptionId = active.id;
        periodEnd = check.periodEnd;
        product =
          check.product !== "core"
            ? check.product
            : resolvePriceProduct(active.items.data[0]?.price?.id);
      }
    } catch (err) {
      console.warn("[STRIPE RECONCILE] customer subs list failed", err);
    }
  }

  // 3) Search Stripe customers by email (covers split Google vs password users)
  if (!foundActive && email) {
    try {
      const customers = await stripe.customers.list({ email, limit: 20 });
      for (const customer of customers.data) {
        const subs = await stripe.subscriptions.list({
          customer: customer.id,
          status: "all",
          limit: 10,
        });
        const active = subs.data.find((s) => isActiveSubscription(s).active);
        if (active) {
          const check = isActiveSubscription(active);
          foundActive = true;
          customerId = customer.id;
          subscriptionId = active.id;
          periodEnd = check.periodEnd;
          product =
            check.product !== "core"
              ? check.product
              : resolvePriceProduct(active.items.data[0]?.price?.id);
          break;
        }
      }
    } catch (err) {
      console.warn("[STRIPE RECONCILE] email customer search failed", err);
    }
  }

  if (!foundActive || !subscriptionId) {
    return { plan: currentPlan, reconciled: false };
  }

  const activeSubscriptions = await stripe.subscriptions
    .list({ customer: customerId!, status: "all", limit: 100 })
    .then((result) =>
      result.data.filter((subscription) => isActiveSubscription(subscription).active),
    )
    .catch((error) => {
      console.warn("[STRIPE RECONCILE] failed to list all subscriptions", error);
      return [];
    });

  let nextPlan = currentPlan;
  for (const activeSubscription of activeSubscriptions) {
    const check = isActiveSubscription(activeSubscription);
    const activeProduct =
      check.product !== "core"
        ? check.product
        : resolvePriceProduct(activeSubscription.items.data[0]?.price?.id);
    nextPlan = grantProduct(nextPlan, activeProduct);
    const { error: productSubscriptionError } = await admin
      .from("product_subscriptions")
      .upsert(
        {
          user_id: userId,
          product: activeProduct,
          stripe_subscription_id: activeSubscription.id,
          status:
            activeSubscription.status === "trialing" ? "trialing" : "active",
          current_period_end: check.periodEnd?.toISOString() ?? null,
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,product" },
      );
    if (productSubscriptionError) {
      console.warn(
        "[STRIPE RECONCILE] Product subscription upsert skipped:",
        productSubscriptionError,
      );
    }
  }
  // Legacy fallback if a Stripe customer has only the subscription discovered
  // above but the all-subscriptions lookup failed.
  if (activeSubscriptions.length === 0) {
    nextPlan = grantProduct(currentPlan, product);
  }

  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      plan: nextPlan,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      current_period_end: periodEnd ? periodEnd.toISOString() : null,
      cancel_at_period_end: false,
    },
    { onConflict: "id" },
  );

  if (error) {
    console.error("[STRIPE RECONCILE] Failed to upsert pro profile:", error);
    return { plan: "free", reconciled: false };
  }

  console.log("[STRIPE RECONCILE] Attached Pro to user", userId, {
    email,
    customerId,
    subscriptionId,
    product,
    plan: nextPlan,
  });

  return { plan: nextPlan, reconciled: true };
}
