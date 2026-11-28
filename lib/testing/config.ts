export const TESTING_EMAIL = "ourlingoisland@gmail.com";
export const PREVIEW_STORAGE_KEY = "lingo_onboarding_preview_v1";

export function previewStorageKey(firstLevel: "control" | "test" = "control") {
 return firstLevel === "test" ? `${PREVIEW_STORAGE_KEY}_first_level_test` : PREVIEW_STORAGE_KEY;
}
