import type {Page} from "@playwright/test";
/** Uses the SDK flag response, with no production query-string or window bypass. */
export async function mockMiniLessonFlag(page:Page,variant:unknown="test") {
  await page.route("**/flags/**",route=>route.fulfill({json:{featureFlags:variant==="missing"?{}:{"mini-lesson-onboarding":variant},featureFlagPayloads:{}}}));
}
