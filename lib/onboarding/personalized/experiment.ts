export const MINI_LESSON_ONBOARDING_FLAG = "mini-lesson-onboarding";
export type OnboardingVariant = "control" | "test";
/** Only the explicit experiment variant enables the new flow. */
export function onboardingVariant(value: unknown): OnboardingVariant {
  return value === "test" ? "test" : "control";
}
