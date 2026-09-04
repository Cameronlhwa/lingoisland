import { createClient } from "@/lib/supabase/server";
import {
  hasAnyProAccess,
  hasHskAccess,
  hasIslandsAccess,
  parseProductPlan,
  type ProductPlan,
} from "@/lib/product-plans";

export type Feature =
  | "create_topic_island"
  | "add_more_words"
  | "generate_story"
  | "regenerate_story"
  | "export_decks"
  | "chat"
  | "mark_known";

export type SubscriptionState =
  | "free"
  | "active_renewing"
  | "canceled_active"
  | "lifetime"
  | "trialing";

const FEATURE_DEFAULTS: Record<Feature, { free: boolean; pro: boolean }> = {
  create_topic_island: { free: false, pro: true },
  add_more_words: { free: false, pro: true },
  generate_story: { free: false, pro: true },
  regenerate_story: { free: false, pro: true },
  export_decks: { free: false, pro: true },
  chat: { free: false, pro: true },
  mark_known: { free: false, pro: true }, // Free: 1/month, Pro: unlimited
};

function isPeriodActive(currentPeriodEnd: string | null | undefined): boolean {
  if (!currentPeriodEnd) return true; // null = lifetime / manual grant
  return new Date(currentPeriodEnd).getTime() > Date.now();
}

export type ProductAccess = "core" | "hsk";

/**
 * Determine the subscription state based on profile data
 */
export function getSubscriptionState(
  plan: ProductPlan | "free" | "pro",
  stripeSubscriptionId: string | null,
  currentPeriodEnd: string | null,
  cancelAtPeriodEnd: boolean
): SubscriptionState {
  if (!hasAnyProAccess(plan)) {
    return "free";
  }

  const hasStripeId = !!stripeSubscriptionId;
  const hasPeriodEnd = !!currentPeriodEnd;

  // Lifetime Pro: paid plan with no Stripe subscription
  if (!hasStripeId && !hasPeriodEnd) {
    return "lifetime";
  }

  // Canceled but still active until period end
  if (cancelAtPeriodEnd && hasPeriodEnd) {
    return "canceled_active";
  }

  // Active subscription that will renew
  if (!cancelAtPeriodEnd && hasPeriodEnd) {
    return "active_renewing";
  }

  // Fallback
  return "active_renewing";
}

export async function getEntitlements(userId: string): Promise<{
  plan: ProductPlan;
  /** Islands Pro (legacy name — prefer isIslandsPro for new code). */
  isPro: boolean;
  isIslandsPro: boolean;
  isHskPro: boolean;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
  cancel_at_period_end: boolean;
  features: Record<Feature, boolean>;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("plan, current_period_end, stripe_subscription_id, cancel_at_period_end")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[ENTITLEMENTS] Failed to load profile:", error);
  }

  const plan = parseProductPlan(data?.plan);
  const currentPeriodEndValue = data?.current_period_end ?? null;
  const stripeSubscriptionId = data?.stripe_subscription_id ?? null;
  const cancelAtPeriodEnd = data?.cancel_at_period_end ?? false;
  const periodOk = isPeriodActive(currentPeriodEndValue);

  // product_subscriptions is the source of truth after its migration ships.
  // Retain the profiles.plan fallback so existing deployments stay functional
  // while the migration is rolling out.
  const { data: productSubscriptions, error: subscriptionsError } =
    await supabase
      .from("product_subscriptions")
      .select("product, status, current_period_end")
      .eq("user_id", userId);
  const hasProductSubscriptionTable = !subscriptionsError;
  if (
    subscriptionsError &&
    subscriptionsError.code !== "42P01" &&
    subscriptionsError.code !== "PGRST205"
  ) {
    console.warn(
      "[ENTITLEMENTS] Failed to load product subscriptions:",
      subscriptionsError,
    );
  }
  const isActiveProduct = (product: ProductAccess) =>
    (productSubscriptions ?? []).some(
      (subscription) =>
        subscription.product === product &&
        (subscription.status === "active" || subscription.status === "trialing") &&
        isPeriodActive(subscription.current_period_end),
    );

  // A rollout may create the table before every existing subscriber has been
  // backfilled. Keep the established profiles.plan entitlement as a fallback
  // until each product has its own subscription row. Webhook cancellation and
  // renewal also update profiles.plan, so this does not revive canceled access.
  const isIslandsPro =
    isActiveProduct("core") ||
    (!hasProductSubscriptionTable || !(productSubscriptions ?? []).some(
      (subscription) => subscription.product === "core",
    )) &&
      hasIslandsAccess(plan) &&
      periodOk;
  const isHskPro =
    isActiveProduct("hsk") ||
    (!hasProductSubscriptionTable || !(productSubscriptions ?? []).some(
      (subscription) => subscription.product === "hsk",
    )) &&
      hasHskAccess(plan) &&
      periodOk;
  // Islands feature gates historically used isPro
  const isPro = isIslandsPro;

  // TODO: Flip specific feature flags in FEATURE_DEFAULTS for selective paywalls.
  const features = Object.fromEntries(
    (Object.keys(FEATURE_DEFAULTS) as Feature[]).map((feature) => [
      feature,
      isPro ? FEATURE_DEFAULTS[feature].pro : FEATURE_DEFAULTS[feature].free,
    ])
  ) as Record<Feature, boolean>;

  return {
    plan,
    isPro,
    isIslandsPro,
    isHskPro,
    current_period_end: currentPeriodEndValue,
    stripe_subscription_id: stripeSubscriptionId,
    cancel_at_period_end: cancelAtPeriodEnd,
    features,
  };
}

/**
 * Product-level authorization for server components and route handlers.
 * Never use product_track or the side cookie for access control: both are
 * preferences that a browser can change.
 */
export async function hasProductAccess(
  userId: string,
  product: ProductAccess,
): Promise<boolean> {
  const entitlements = await getEntitlements(userId);
  return product === "core"
    ? entitlements.isIslandsPro
    : entitlements.isHskPro;
}

/**
 * Get month key in format "YYYY-MM"
 */
export function getMonthKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Get or create usage row for the current month
 */
export async function getOrCreateUsageRow(
  userId: string,
  monthKey: string = getMonthKey()
): Promise<{
  id: string;
  user_id: string;
  month_key: string;
  topic_islands_created: number;
  stories_created: number;
  words_marked_known: number;
} | null> {
  const supabase = await createClient();

  // Try to get existing row
  const { data: existing, error: selectError } = await supabase
    .from("usage_monthly")
    .select("*")
    .eq("user_id", userId)
    .eq("month_key", monthKey)
    .maybeSingle();

  if (selectError && selectError.code !== "PGRST116") {
    // PGRST116 = no rows returned
    console.error("[USAGE] Error fetching usage row:", selectError);
    return null;
  }

  if (existing) {
    return existing;
  }

  // Create new row
  const { data: created, error: insertError } = await supabase
    .from("usage_monthly")
    .insert({
      user_id: userId,
      month_key: monthKey,
      topic_islands_created: 0,
      stories_created: 0,
      words_marked_known: 0,
    })
    .select()
    .single();

  if (insertError) {
    console.error("[USAGE] Error creating usage row:", insertError);
    return null;
  }

  return created;
}

/**
 * Check if user can create a topic island (Free: 1 per month, Pro: unlimited)
 */
export async function canCreateTopicIsland(
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const entitlements = await getEntitlements(userId);

  // Pro users can create unlimited islands
  if (entitlements.isPro) {
    return { allowed: true };
  }

  // Free users: check monthly limit
  const monthKey = getMonthKey();
  const usage = await getOrCreateUsageRow(userId, monthKey);

  if (!usage) {
    return { allowed: false, reason: "Failed to check usage limits" };
  }

  if (usage.topic_islands_created >= 1) {
    return {
      allowed: false,
      reason: "Free plan allows 1 topic island per month. Upgrade to Pro for unlimited islands.",
    };
  }

  return { allowed: true };
}

/**
 * Increment topic island creation count for the current month
 */
export async function incrementTopicIslandCount(userId: string): Promise<void> {
  const supabase = await createClient();
  const monthKey = getMonthKey();

  // Get or create usage row
  const usage = await getOrCreateUsageRow(userId, monthKey);
  if (!usage) {
    console.error("[USAGE] Failed to get/create usage row for increment");
    return;
  }

  // Increment count
  const { error } = await supabase
    .from("usage_monthly")
    .update({
      topic_islands_created: usage.topic_islands_created + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", usage.id);

  if (error) {
    console.error("[USAGE] Error incrementing island count:", error);
  }
}

/**
 * Check if a word is locked based on position and user plan
 */
export function isWordLocked(position: number, isPro: boolean): boolean {
  if (isPro) {
    return false; // Pro users have no locks
  }
  return position > 10; // Free users: words 11-20 are locked
}

/**
 * Filter words to only include unlocked words for free users
 */
export function filterUnlockedWords<T extends { position?: number | null }>(
  words: T[],
  isPro: boolean
): T[] {
  if (isPro) {
    return words; // Pro users see all words
  }
  return words.filter((word) => {
    const pos = word.position ?? 999;
    return pos <= 10;
  });
}

/**
 * Check if user can mark a word as known (Free: 1 per month, Pro: unlimited)
 */
export async function canMarkWordKnown(
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const entitlements = await getEntitlements(userId);

  // Pro users can mark unlimited words as known
  if (entitlements.isPro) {
    return { allowed: true };
  }

  // Free users: check monthly limit (1 per month)
  const monthKey = getMonthKey();
  const usage = await getOrCreateUsageRow(userId, monthKey);

  if (!usage) {
    return { allowed: false, reason: "Failed to check usage limits" };
  }

  // Handle potential NULL values from existing rows
  const wordsMarkedKnown = usage.words_marked_known ?? 0;

  if (wordsMarkedKnown >= 1) {
    return {
      allowed: false,
      reason: 'Free plan allows 1 "Already know" per month. Upgrade to Pro for unlimited replacements.',
    };
  }

  return { allowed: true };
}

/**
 * Increment words_marked_known count for the current month
 */
export async function incrementMarkKnownCount(userId: string): Promise<void> {
  const supabase = await createClient();
  const monthKey = getMonthKey();

  // Get or create usage row
  const usage = await getOrCreateUsageRow(userId, monthKey);
  if (!usage) {
    console.error("[USAGE] Failed to get/create usage row for mark known increment");
    return;
  }

  // Handle potential NULL values from existing rows
  const currentCount = usage.words_marked_known ?? 0;

  // Increment count
  const { error } = await supabase
    .from("usage_monthly")
    .update({
      words_marked_known: currentCount + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", usage.id);

  if (error) {
    console.error("[USAGE] Error incrementing mark known count:", error);
  }
}
