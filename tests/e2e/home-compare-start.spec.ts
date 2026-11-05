import { expect, test } from "@playwright/test";

test.describe("homepage topic comparison Start links", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("every Start opens onboarding", async ({ page }) => {
    await page.goto("/");
    const card = page.getByLabel("LingoIsland's flexible, personalized topic order");
    await card.scrollIntoViewIfNeeded();

    const starts = card.getByRole("link", { name: /^Start / });
    await expect(starts).toHaveCount(3);
    for (const link of await starts.all()) {
      await expect(link).toHaveAttribute("href", "/onboarding/journey");
    }

    await starts.first().click();
    await expect(page).toHaveURL(/\/onboarding\/journey$/);
  });

  test("the HSK prep page keeps static Start labels", async ({ page }) => {
    await page.goto("/hskprep");
    const card = page.getByLabel("LingoIsland's flexible, personalized topic order");
    await expect(card.getByText("Start →").first()).toBeAttached();
    await expect(card.getByRole("link", { name: /^Start / })).toHaveCount(0);
  });
});
