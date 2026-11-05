import { expect, test, type Locator, type Page } from "@playwright/test";

const HEADLINE = "Turn 10 minutes into Mandarin you can actually use";
const SUBTITLE = "Personalized lessons for your work, studies, and real life.";
const BUTTON_LABEL = "Build my learning plan";
const BUTTON_HREF = "/onboarding/journey";

type Viewport = { name: string; width: number; height: number };

const MOBILE: Viewport[] = [
  { name: "mobile", width: 390, height: 844 },
  { name: "small mobile", width: 375, height: 812 },
];
const MEDIUM: Viewport[] = [
  { name: "medium", width: 768, height: 1024 },
  { name: "large medium", width: 900, height: 1100 },
];
const DESKTOP: Viewport = { name: "desktop", width: 1280, height: 900 };
const ALL = [...MOBILE, ...MEDIUM, DESKTOP];

type Box = { x: number; y: number; width: number; height: number };

async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  if (!b) throw new Error("Element has no bounding box");
  return b;
}

function overlaps(a: Box, b: Box, tolerance = 1): boolean {
  return (
    a.x < b.x + b.width - tolerance &&
    b.x < a.x + a.width - tolerance &&
    a.y < b.y + b.height - tolerance &&
    b.y < a.y + a.height - tolerance
  );
}

async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}

/** Opens the homepage and waits for the CTA's scroll fade-in to settle so boxes are final. */
async function openCta(page: Page) {
  await page.goto("/");
  const cta = page.getByTestId("final-cta");
  await cta.scrollIntoViewIfNeeded();
  await expect
    .poll(() => cta.evaluate((el) => getComputedStyle(el.closest("section") ?? el).opacity))
    .toBe("1");
  return {
    cta,
    copy: page.getByTestId("final-cta-copy"),
    art: page.getByTestId("final-cta-art"),
    button: page.getByTestId("final-cta-button"),
    headline: cta.getByRole("heading", { level: 2 }),
    subtitle: cta.getByText(SUBTITLE, { exact: true }),
  };
}

async function expectTextClearOfArt(parts: Awaited<ReturnType<typeof openCta>>) {
  const art = await box(parts.art);
  for (const text of [parts.headline, parts.subtitle, parts.button]) {
    expect(overlaps(await box(text), art)).toBe(false);
  }
}

for (const vp of ALL) {
  test.describe(`homepage final CTA content at ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("shows only the approved copy and primary action", async ({ page }) => {
      const { cta, headline, subtitle, button } = await openCta(page);

      await expect(headline).toBeVisible();
      await expect(headline).toHaveText(HEADLINE);
      await expect(headline.getByText("actually use", { exact: true })).toBeVisible();
      await expect(subtitle).toBeVisible();

      await expect(button).toBeVisible();
      await expect(button).toHaveText(new RegExp(`^${BUTTON_LABEL}`));
      await expect(button).toHaveAttribute("href", BUTTON_HREF);

      await expect(cta.getByText("See how it works")).toHaveCount(0);
      await expect(cta).not.toContainText(/membership/i);
      await expect(cta).not.toContainText(/free trial|try for free/i);
      await expect(cta.getByRole("link")).toHaveCount(1);

      expect(await hasHorizontalOverflow(page)).toBe(false);
    });
  });
}

for (const vp of MOBILE) {
  test.describe(`homepage final CTA mobile layout at ${vp.width}px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("stacks copy, full-width button, then cropped artwork", async ({ page }) => {
      const parts = await openCta(page);
      const card = await box(parts.cta);
      const copy = await box(parts.copy);
      const art = await box(parts.art);
      const button = await box(parts.button);

      expect(art.y).toBeGreaterThanOrEqual(copy.y + copy.height - 1);
      expect(art.y).toBeGreaterThanOrEqual(button.y + button.height);

      // Full width inside the copy area's ~22px side padding.
      expect(button.width).toBeGreaterThanOrEqual(copy.width - 2 * 22 - 4);
      expect(button.width).toBeLessThanOrEqual(copy.width);
      expect(button.height).toBeGreaterThanOrEqual(52);

      expect(art.height).toBeGreaterThanOrEqual(180);
      expect(art.height).toBeLessThanOrEqual(240);
      expect(Math.abs(art.width - card.width)).toBeLessThanOrEqual(2);

      expect(card.x).toBeGreaterThanOrEqual(12);
      expect(card.x + card.width).toBeLessThanOrEqual(vp.width - 12);
      expect(card.height).toBeLessThanOrEqual(700);

      await expectTextClearOfArt(parts);
    });
  });
}

for (const vp of MEDIUM) {
  test.describe(`homepage final CTA medium layout at ${vp.width}px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("places copy and artwork side by side in a compact card", async ({ page }) => {
      const parts = await openCta(page);
      const card = await box(parts.cta);
      const copy = await box(parts.copy);
      const art = await box(parts.art);
      const button = await box(parts.button);

      expect(art.x).toBeGreaterThanOrEqual(copy.x + copy.width - 1);
      expect(Math.abs(art.y - copy.y)).toBeLessThanOrEqual(30);
      expect(art.width).toBeGreaterThan(card.width * 0.35);

      expect(button.width).toBeLessThan(copy.width * 0.8);

      expect(card.height).toBeGreaterThanOrEqual(420);
      expect(card.height).toBeLessThanOrEqual(560);

      expect(card.x).toBeGreaterThanOrEqual(0);
      expect(card.x + card.width).toBeLessThanOrEqual(vp.width);

      await expectTextClearOfArt(parts);
    });
  });
}

test.describe(`homepage final CTA desktop layout at ${DESKTOP.width}px`, () => {
  test.use({ viewport: { width: DESKTOP.width, height: DESKTOP.height } });

  test("keeps the centered split card", async ({ page }) => {
    const parts = await openCta(page);
    const card = await box(parts.cta);
    const copy = await box(parts.copy);
    const art = await box(parts.art);

    expect(art.x).toBeGreaterThanOrEqual(copy.x + copy.width - 1);
    expect(Math.abs(art.y - copy.y)).toBeLessThanOrEqual(30);

    const leftGap = card.x;
    const rightGap = DESKTOP.width - (card.x + card.width);
    expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(2);

    await expect(parts.button).toBeVisible();
    expect(card.width).toBeLessThanOrEqual(DESKTOP.width);
    expect(await hasHorizontalOverflow(page)).toBe(false);

    await expectTextClearOfArt(parts);
  });
});
