import { expect, test } from "@playwright/test";

test.describe("Huahua pre-paywall taste", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "lingo_onboarding_checkout_v1",
        JSON.stringify({
          v: 1,
          topic: "Talking with clients",
          journeyTopic: "Talking with clients",
          islandLevel: "B1",
          wordsLearned: 0,
          wordsPerWeek: 30,
          lockedIslands: [],
          plan: "monthly",
          daysPerWeek: 3,
          timeLabel: "15min",
        }),
      );
    });
  });

  test("requires an account before showing real phone setup", async ({ page }) => {
    await page.goto("/onboarding/journey?resume=texting");

    const intro = page.getByTestId("huahua-prepaywall-intro");
    await expect(intro.getByText("Meet 华华, your Mandarin texting partner")).toBeVisible();
    await expect(intro.getByRole("button", { name: "Text me with 华华" })).toBeVisible();
    await expect(page.getByPlaceholder("Mobile number")).toHaveCount(0);
    await expect(page.getByTestId("huahua-onboarding-style")).toHaveCount(0);

    await intro.getByRole("button", { name: "Text me with 华华" }).click();
    await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();
    await expect(page.getByText(/so Huahua can remember your level/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Not now" })).toBeVisible();
  });
});
