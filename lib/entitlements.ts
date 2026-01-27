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
  features: Record<Feature, boolean>;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("plan, current_period_end")
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

  return { plan, isPro, current_period_end: currentPeriodEndValue, features };
}
