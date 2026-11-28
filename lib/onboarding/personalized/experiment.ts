export const MINI_LESSON_ONBOARDING_FLAG = "mini-lesson-onboarding";
export type OnboardingVariant = "control" | "test";
/** Only the explicit experiment variant enables the new flow. */
export function onboardingVariant(value: unknown): OnboardingVariant {
  return value === "test" ? "test" : "control";
}

/** Independent experiment for Course 1; missing/unavailable flags keep greetings. */
export const FIRST_LEVEL_TEST_FLAG = "first-level-test";
export type FirstLevelVariant = "control" | "test";
export function firstLevelVariant(value: unknown): FirstLevelVariant { return value === "test" ? "test" : "control"; }
