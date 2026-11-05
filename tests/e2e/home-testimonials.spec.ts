import { expect, test, type Page } from "@playwright/test";

const HEADING = "Mandarin built around real life";
const EYEBROW = "Learner reviews";
const SUPPORTING = "Real feedback from LingoIsland learners";
const QUOTES = [
  "I spoke some Mandarin at home growing up, but I still struggled with clients from China. LingoIsland helped me focus on the business vocabulary I actually needed, and I now feel much more confident building connections.",
  "I have little time to study, so focusing on common business and banking vocabulary made a huge difference. My conversations with Chinese clients now feel more natural and productive.",
  "As a doctor, I do not need every Mandarin word. I need the right medical terms for my patients. LingoIsland gave me a focused plan built around the vocabulary I use at work.",
  "LingoIsland helped me prepare for China with vocabulary for airports, subways, restaurants, and attractions. Speaking with locals made the entire trip more rewarding.",
];
const AUTOPLAY_MS = 7000;

type Viewport = { width: number; height: number; perView: number };

const VIEWPORTS: Viewport[] = [
  { width: 375, height: 812, perView: 1 },
  { width: 390, height: 844, perView: 1 },
  { width: 768, height: 1024, perView: 1 },
  { width: 1024, height: 900, perView: 2 },
  { width: 1280, height: 900, perView: 2 },
];

/** Opens the homepage and waits for the section's scroll fade-in to settle. */
async function openCarousel(page: Page) {
  await page.goto("/");
  const carousel = page.getByTestId("testimonial-carousel");
  await carousel.scrollIntoViewIfNeeded();
  await expect
    .poll(() => carousel.evaluate((el) => getComputedStyle(el.closest("section") ?? el).opacity))
    .toBe("1");
  return carousel;
}

function dot(page: Page, n: number) {
  return page.getByRole("button", { name: `Show testimonial ${n}`, exact: true });
}

/** Quotes of every slide (clones included) that sits fully inside the carousel window. */
async function quotesInView(page: Page): Promise<string[]> {
  return page.getByTestId("testimonial-track").evaluate((track) => {
    const win = track.parentElement!.getBoundingClientRect();
    return Array.from(track.children)
      .filter((slide) => {
        const b = slide.getBoundingClientRect();
        return b.width > 0 && b.left >= win.left - 1 && b.right <= win.right + 1;
      })
      .map((slide) => slide.querySelector("blockquote")?.textContent?.trim() ?? "");
  });
}

async function expectActive(page: Page, n: number) {
  await expect(dot(page, n)).toHaveAttribute("aria-current", "true");
  await expect(page.locator('[data-testid="testimonial-dot"][aria-current]')).toHaveCount(1);
  await expect(page.locator('[data-testid="testimonial-card"][data-active="true"]')).toHaveText(
    new RegExp(QUOTES[n - 1].slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  );
  await expect.poll(async () => (await quotesInView(page))[0]).toBe(QUOTES[n - 1]);
}

async function hasHorizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}

for (const vp of VIEWPORTS) {
  test.describe(`homepage testimonials at ${vp.width}x${vp.height}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("shows the learner carousel instead of the founder testimonial", async ({ page }) => {
      const carousel = await openCarousel(page);
      const section = page.locator("section", { has: carousel });

      await expect(page.getByRole("heading", { level: 2, name: HEADING })).toBeVisible();
      await expect(section.getByText(EYEBROW, { exact: true })).toBeVisible();
      await expect(section.getByText(SUPPORTING, { exact: true })).toBeVisible();
      await expect(page.getByRole("region", { name: "Learner testimonials" })).toBeVisible();

      const cards = carousel.getByTestId("testimonial-card");
      await expect(cards).toHaveCount(QUOTES.length);
      for (const quote of QUOTES) {
        await expect(cards.filter({ hasText: quote })).toHaveCount(1);
      }

      await expect(page.getByText(/125K\+ subscribers/i)).toHaveCount(0);
      await expect(page.getByText(/reached conversational fluency/i)).toHaveCount(0);
      await expect(page.getByLabel(/out of 5 stars/i)).toHaveCount(0);
      await expect(page.locator('img[src*="cameron-lim-profile"]')).toHaveCount(0);
      await expect(section).not.toContainText(/Cameron|founder/i);
      await expect(section.locator("img, svg[aria-label*='star' i]")).toHaveCount(0);

      expect(await hasHorizontalOverflow(page)).toBe(false);
    });

    test(`shows ${vp.perView} complete card(s) with consistent heights`, async ({ page }) => {
      await openCarousel(page);

      await expect.poll(async () => (await quotesInView(page)).length).toBe(vp.perView);
      expect(await quotesInView(page)).toEqual(QUOTES.slice(0, vp.perView));

      const metrics = await page.getByTestId("testimonial-card").evaluateAll((cards) =>
        cards.map((c) => ({
          height: c.getBoundingClientRect().height,
          clipped: c.scrollHeight > c.clientHeight + 1 || c.scrollWidth > c.clientWidth + 1,
        }))
      );
      const heights = metrics.map((m) => m.height);
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
      expect(metrics.some((m) => m.clipped)).toBe(false);

      for (const control of [
        page.getByTestId("testimonial-previous"),
        page.getByTestId("testimonial-next"),
      ]) {
        const b = (await control.boundingBox())!;
        expect(Math.min(b.width, b.height)).toBeGreaterThanOrEqual(44);
      }
      const dotBox = (await dot(page, 1).boundingBox())!;
      expect(Math.min(dotBox.width, dotBox.height)).toBeGreaterThanOrEqual(24);

      expect(await hasHorizontalOverflow(page)).toBe(false);
    });
  });
}

for (const vp of [VIEWPORTS[1], VIEWPORTS[4]]) {
  test.describe(`homepage testimonial controls at ${vp.width}px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("arrows and dots change the active testimonial and loop", async ({ page }) => {
      await openCarousel(page);
      const previous = page.getByTestId("testimonial-previous");
      const next = page.getByTestId("testimonial-next");

      await expect(previous).toHaveAccessibleName("Previous testimonial");
      await expect(next).toHaveAccessibleName("Next testimonial");
      for (let n = 1; n <= QUOTES.length; n++) {
        await expect(page.getByTestId("testimonial-dot").nth(n - 1)).toHaveAccessibleName(
          `Show testimonial ${n}`
        );
      }
      await expectActive(page, 1);

      await next.click();
      await expectActive(page, 2);
      await expect(dot(page, 1)).not.toHaveAttribute("aria-current");

      await previous.click();
      await expectActive(page, 1);

      await dot(page, 3).click();
      await expectActive(page, 3);
      await expect(dot(page, 1)).not.toHaveAttribute("aria-current");

      await dot(page, 4).click();
      await expectActive(page, 4);
      await next.click();
      await expectActive(page, 1);
      await previous.click();
      await expectActive(page, 4);
    });

    test("controls work from the keyboard", async ({ page }) => {
      await openCarousel(page);
      await page.getByTestId("testimonial-next").focus();
      await page.keyboard.press("Enter");
      await expectActive(page, 2);
      await expect(page.getByTestId("testimonial-next")).toBeFocused();

      await page.keyboard.press("Tab");
      await expect(page.getByTestId("testimonial-next")).not.toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Shift+Tab");
      await expect(dot(page, 4)).toBeFocused();
      await page.keyboard.press("Space");
      await expectActive(page, 4);
    });
  });
}

test.describe("homepage testimonial autoplay", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("advances on its own when motion is allowed", async ({ page }) => {
    await page.clock.install();
    await openCarousel(page);
    await page.mouse.move(0, 0);
    await expectActive(page, 1);

    await page.clock.runFor(AUTOPLAY_MS + 500);
    await expectActive(page, 2);
  });

  test.describe("with reduced motion", () => {
    test.use({ reducedMotion: "reduce" });

    test("does not autoplay, but manual controls still work", async ({ page }) => {
      await page.clock.install();
      await openCarousel(page);
      await page.mouse.move(0, 0);
      await expectActive(page, 1);

      await page.clock.runFor(AUTOPLAY_MS * 3);
      await expectActive(page, 1);

      await page.getByTestId("testimonial-next").click();
      await expectActive(page, 2);
    });
  });
});

test.describe("homepage testimonial touch gestures", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("a horizontal swipe changes slides and a vertical drag scrolls the page", async ({
    page,
  }) => {
    await openCarousel(page);
    // The track itself is translated, so aim at the active card. The page uses
    // smooth scrolling, so jump instead of measuring mid-scroll.
    const activeCard = page.locator('[data-testid="testimonial-card"][data-active="true"]');
    await activeCard.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    const cdp = await page.context().newCDPSession(page);
    const card = (await activeCard.boundingBox())!;
    const x = Math.round(card.x + card.width / 2);
    const y = Math.round(card.y + Math.min(card.height / 2, 120));

    const drag = async (dx: number, dy: number) => {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      const steps = 12;
      for (let i = 1; i <= steps; i++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps }],
        });
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };

    await drag(-160, 6);
    await expectActive(page, 2);

    const before = await page.evaluate(() => window.scrollY);
    await drag(4, -240);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 100);
    await expectActive(page, 2);
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});
