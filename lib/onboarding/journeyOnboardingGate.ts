import type { SupabaseClient } from "@supabase/supabase-js";
import { hasAnyProAccess } from "@/lib/product-plans";

/**
 * Journey wizard at /app/onboarding should run only for accounts that explicitly
 * need it (onboarding_complete === false) and have no prior app activity.
 * Existing users who already have islands/journeys, or who already have paid
 * access (including manual grants), get the flag healed to true instead of
 * being trapped in first-run setup.
 */
export async function evaluateJourneyOnboardingGate(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  needsJourneyWizard: boolean;
  /** True when we should set onboarding_complete = true (legacy / inconsistent row) */
  shouldMarkOnboardingComplete: boolean;
}> {
  const { data: prof } = await supabase
    .from("profiles")
    .select("onboarding_complete, active_journey_id, plan")
    .eq("id", userId)
    .maybeSingle();

  if (!prof) {
    return { needsJourneyWizard: false, shouldMarkOnboardingComplete: false };
  }

  if (prof.onboarding_complete === true) {
    return { needsJourneyWizard: false, shouldMarkOnboardingComplete: false };
  }

  if (hasAnyProAccess(prof.plan)) {
    return {
      needsJourneyWizard: false,
      shouldMarkOnboardingComplete: true,
    };
  }

  const [{ count: islandC }, { count: journeyC }] = await Promise.all([
    supabase
      .from("topic_islands")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("journeys")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  const hasActivity =
    (islandC ?? 0) > 0 ||
    (journeyC ?? 0) > 0 ||
    prof.active_journey_id != null;

  if (hasActivity) {
    return {
      needsJourneyWizard: false,
      shouldMarkOnboardingComplete: prof.onboarding_complete === false,
    };
  }

  return {
    needsJourneyWizard: prof.onboarding_complete === false,
    shouldMarkOnboardingComplete: false,
  };
}

export async function markJourneyOnboardingComplete(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  await supabase
    .from("profiles")
    .update({ onboarding_complete: true })
    .eq("id", userId);
}
