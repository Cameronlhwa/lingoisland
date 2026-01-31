import { createClient } from "@/lib/supabase/server";

export type Feature =
  | "create_topic_island"
  | "add_more_words"
  | "generate_story"
  | "regenerate_story"
  | "export_decks"
  | "chat";

const FEATURE_DEFAULTS: Record<Feature, { free: boolean; pro: boolean }> = {
  create_topic_island: { free: false, pro: true },
  add_more_words: { free: false, pro: true },
  generate_story: { free: false, pro: true },
  regenerate_story: { free: false, pro: true },
  export_decks: { free: false, pro: true },
  chat: { free: false, pro: true },
};

export async function getEntitlements(userId: string): Promise<{
  plan: "free" | "pro";
  isPro: boolean;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
  features: Record<Feature, boolean>;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("plan, current_period_end, stripe_subscription_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[ENTITLEMENTS] Failed to load profile:", error);
  }

  const plan = data?.plan === "pro" ? "pro" : "free";
  const currentPeriodEnd = data?.current_period_end
    ? new Date(data.current_period_end)
    : null;
  const currentPeriodEndValue = data?.current_period_end ?? null;
  const stripeSubscriptionId = data?.stripe_subscription_id ?? null;
  
  // User is considered Pro if plan='pro' AND either:
  // 1. current_period_end is NULL (manual grant with no expiry)
  // 2. current_period_end is in the future (active Stripe subscription)
  const isPro =
    plan === "pro" &&
    (!currentPeriodEnd || currentPeriodEnd.getTime() > Date.now());

  // TODO: Flip specific feature flags in FEATURE_DEFAULTS for selective paywalls.
  const features = Object.fromEntries(
    (Object.keys(FEATURE_DEFAULTS) as Feature[]).map((feature) => [
      feature,
      isPro ? FEATURE_DEFAULTS[feature].pro : FEATURE_DEFAULTS[feature].free,
    ])
  ) as Record<Feature, boolean>;

  return { plan, isPro, current_period_end: currentPeriodEndValue, stripe_subscription_id: stripeSubscriptionId, features };
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
