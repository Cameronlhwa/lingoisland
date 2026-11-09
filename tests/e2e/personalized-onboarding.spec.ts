import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

// Every server call is mocked: nothing here reaches Supabase, Telnyx, SpeechSuper or Stripe.

type MockOptions = {
  account?: "guest" | "user";
  firstName?: string | null;
  /** The first N progress saves fail with a database error. */
  failSaves?: number;
};

type Mocks = {
  savedStates: Array<Record<string, unknown>>;
  requests: Array<{ url: string; body: string }>;
  checkoutBodies: Array<Record<string, unknown>>;
  failedSaves: number;
};

const CUSTOM_INTEREST = "Zither duets";

/** Endpoints the phone version of onboarding used. This flow must never call them. */
const PHONE_ENDPOINTS = /\/api\/(sms\/|onboarding\/messaging|onboarding\/huahua-)/;

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "medium", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function setup(page: Page, options: MockOptions = {}): Promise<Mocks> {
  const mocks: Mocks = { savedStates: [], requests: [], checkoutBodies: [], failedSaves: 0 };
  const account = options.account ?? "guest";
  let stored: Record<string, unknown> | null = null;
  let revision = 0;

  await page.addInitScript(() => {
    (window as unknown as { __lingoAnalyticsSpy: boolean }).__lingoAnalyticsSpy = true;
  });

  page.on("request", (request) => {
    if (request.url().startsWith("http://localhost:3002/api/")) {
      mocks.requests.push({ url: request.url(), body: request.postData() ?? "" });
    }
  });

  await page.route("**/api/onboarding/progress**", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      return json(route, {
        account: { kind: account, firstName: options.firstName ?? null },
        progress: stored,
      });
    }
    const body = route.request().postDataJSON() as { state: Record<string, unknown> };
    if ((options.failSaves ?? 0) > mocks.failedSaves) {
      mocks.failedSaves += 1;
      return json(route, { error: "Could not save progress." }, 500);
    }
    mocks.savedStates.push(body.state);
    revision += 1;
    stored = { ...body.state, revision, updatedAt: new Date().toISOString(), activatedAt: null };
    return json(route, { status: "saved", progress: stored });
  });
  await page.route("**/api/onboarding/abandon", (route) => json(route, { status: "ok" }));
  await page.route("**/api/onboarding/pronunciation", (route) => json(route, { status: "ok", needsToneSupport: false }));
  await page.route(PHONE_ENDPOINTS, (route) => json(route, { error: "Not part of this flow" }, 404));
  await page.route("**/api/entitlements**", (route) => json(route, { isPro: false, products: [] }));
  await page.route("**/api/stripe/checkout", async (route) => {
    mocks.checkoutBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    return json(route, { error: "Mock checkout" }, 500);
  });
  return mocks;
}

function phoneRequests(mocks: Mocks) {
  return mocks.requests.filter((request) => PHONE_ENDPOINTS.test(new URL(request.url).pathname));
}

async function heading(page: Page, name: string | RegExp) {
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({ timeout: 15_000 });
}

async function next(page: Page) {
  await page.getByTestId("continue").click();
}

async function profile(
  page: Page,
  input: { goal: string; interests: string[]; level: string; custom?: string },
) {
  await page.goto("/onboarding/journey");
  await heading(page, "Why do you want to learn Mandarin?");
  await page.getByTestId(`goal-${input.goal}`).click();
  await next(page);
  await heading(page, "What would you like to talk about in Mandarin?");
  for (const interest of input.interests) await page.getByTestId(`interest-${interest}`).click();
  if (input.custom) {
    await page.getByRole("button", { name: "Add your own" }).click();
    await page.getByLabel("Your own topic").fill(input.custom);
    await page.getByRole("button", { name: "Add", exact: true }).click();
  }
  await next(page);
  await heading(page, "How does your Mandarin feel right now?");
  await page.getByTestId(`level-${input.level}`).click();
  await next(page);
}

async function calibrate(page: Page) {
  const questionCounter = (position: number) =>
    page.getByTestId("onboarding-step").getByText(`Question ${position} of 5`);
  await heading(page, "Let’s personalize your starting point");
  await page.getByTestId("calibration-start").click();
  await expect(page.getByTestId("calibration-feedback")).toHaveCount(0);
  await expect(page.getByTestId("calibration-next")).toHaveCount(0);
  await expect(questionCounter(1)).toBeVisible();
  const firstChoices = page.getByTestId("calibration-choice");
  await firstChoices.first().click();
  await expect(questionCounter(2)).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(questionCounter(1)).toBeVisible();
  await expect(firstChoices.first()).toHaveAttribute("aria-pressed", "true");
  await firstChoices.nth(1).click();

  for (let index = 1; index < 5; index += 1) {
    await expect(questionCounter(index + 1)).toBeVisible();
    await page.getByTestId("calibration-choice").first().click();
  }
  await heading(page, "Want to personalize your speaking practice too?");
}

async function availability(page: Page, minutes = "10", days = "5") {
  await heading(page, "How much time can you usually spend learning Mandarin?");
  await page.getByTestId(`minutes-${minutes}`).click();
  await page.getByTestId(`days-${days}`).click();
  if (Number(minutes) >= 30 || minutes.startsWith("60")) await page.getByTestId("session-auto").click();
  await next(page);
}

type ProfileInput = { goal: string; interests: string[]; level: string; custom?: string; minutes?: string; days?: string };

async function toPlan(page: Page, input: ProfileInput) {
  await profile(page, input);
  await calibrate(page);
  await heading(page, "Want to personalize your speaking practice too?");
  await page.getByTestId("pronunciation-skip").click();
  await availability(page, input.minutes, input.days);
  await heading(page, "Here’s your personalized plan");
}

/** The plan's Continue goes straight to the commitment screen. */
async function toCommitment(page: Page, input: ProfileInput) {
  await toPlan(page, input);
  await next(page);
  await heading(page, "Ready to begin your Mandarin journey?");
}

async function analyticsEvents(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __lingoAnalyticsEvents?: Array<{ event: string; properties: Record<string, unknown> }> }).__lingoAnalyticsEvents ?? [],
  );
}

function isMobile(page: Page) {
  return (page.viewportSize()?.width ?? 1280) < 768;
}

for (const viewport of VIEWPORTS) {
  test.describe(`personalized onboarding (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });
    test.describe.configure({ timeout: 120_000 });

    test("1. absolute beginner goes from the plan straight to the commitment and the paywall", async ({ page }) => {
      await setup(page);
      await profile(page, { goal: "everyday", interests: ["food"], level: "new" });
      await calibrate(page);
      await page.getByTestId("pronunciation-skip").click();
      await availability(page, "5", "3");
      await heading(page, "Here’s your personalized plan");
      const journeyCount = await page.getByTestId("plan-journeys").locator("li").count();
      expect(journeyCount).toBeGreaterThanOrEqual(2);
      expect(journeyCount).toBeLessThanOrEqual(3);
      await next(page);
      await heading(page, "Ready to begin your Mandarin journey?");
      await page.getByTestId("commitment-cta").click();
      await expect(page.getByRole("heading", {
        name: isMobile(page)
          ? "Activate your 5-minute Mandarin plan for everyday life"
          : "Build useful Mandarin for everyday life",
      })).toBeVisible({ timeout: 15_000 });
    });

    test("2. never asks for a phone number or calls the texting services", async ({ page }) => {
      const mocks = await setup(page, { account: "user", firstName: "Cameron" });
      await toPlan(page, { goal: "work", interests: ["meetings", "clients"], level: "basic_conversations" });
      await expect(page.getByRole("progressbar", { name: "Onboarding progress" })).toHaveAttribute("aria-valuetext", /Step 7 of 8/);
      await next(page);
      await heading(page, "Ready to begin your Mandarin journey?");
      await expect(page.getByRole("progressbar", { name: "Onboarding progress" })).toHaveAttribute("aria-valuetext", /Step 8 of 8/);
      await expect(page.getByText(/Meet Huahua|Where should Huahua message you|phone number/i)).toHaveCount(0);
      await expect(page.locator("input[type=tel]")).toHaveCount(0);
      await expect(page.getByTestId("commitment-card")).toContainText("Add Huahua anytime");
      await page.getByTestId("commitment-cta").click();
      await expect(page.getByTestId("onboarding-step")).toHaveCount(0, { timeout: 15_000 });
      expect(phoneRequests(mocks)).toEqual([]);
      const saved = mocks.savedStates[mocks.savedStates.length - 1] as { answers: { messaging: { status: string } } };
      expect(saved.answers.messaging.status).toBe("not_started");
    });

    test("3. progress saved on a phone step resumes at the commitment", async ({ page }) => {
      await setup(page);
      await toCommitment(page, { goal: "travel", interests: ["restaurants"], level: "few_words" });
      for (const step of ["huahua", "messaging", "huahua_prefs", "preview"]) {
        await page.goto(`/onboarding/journey?resume=${step}`);
        await heading(page, "Ready to begin your Mandarin journey?");
      }
      await page.getByRole("button", { name: "Back" }).click();
      await heading(page, "Here’s your personalized plan");
    });

    test("4. returning learner resumes where they left off", async ({ page }) => {
      await setup(page);
      await profile(page, { goal: "heritage", interests: ["family_conversations"], level: "few_words" });
      await heading(page, "Let’s personalize your starting point");
      await page.reload();
      await heading(page, "Let’s personalize your starting point");
      await page.getByRole("button", { name: "Back" }).click();
      await heading(page, "How does your Mandarin feel right now?");
      await expect(page.getByTestId("level-few_words")).toHaveAttribute("aria-pressed", "true");
    });

    test("calibration advances automatically and lets learners revise answers", async ({ page }) => {
      await setup(page);
      await profile(page, { goal: "everyday", interests: ["food"], level: "new" });
      await calibrate(page);
    });

    test("5. changing an earlier answer updates the plan", async ({ page }) => {
      await setup(page);
      await toPlan(page, { goal: "work", interests: ["sales"], level: "simple_sentences", minutes: "10", days: "3" });
      await expect(page.getByText("10 minutes a day, 3 days a week")).toBeVisible();
      await page.getByRole("button", { name: "Back" }).click();
      await heading(page, "How much time can you usually spend learning Mandarin?");
      await page.getByTestId("minutes-30").click();
      await page.getByTestId("session-short_sessions").click();
      await next(page);
      await heading(page, "Here’s your personalized plan");
      await expect(page.getByText(/30 minutes a day, 3 days a week/)).toBeVisible();
    });

    test("6. microphone permission denied continues without blocking", async ({ page }) => {
      await setup(page);
      await page.addInitScript(() => {
        Object.defineProperty(navigator, "mediaDevices", {
          configurable: true,
          value: { getUserMedia: () => Promise.reject(new DOMException("Permission denied", "NotAllowedError")) },
        });
      });
      await profile(page, { goal: "travel", interests: ["hotels"], level: "new" });
      await calibrate(page);
      await page.getByTestId("pronunciation-try").click();
      await expect(page.getByTestId("pronunciation-record")).toHaveAccessibleName(/Record yourself saying/);
      await page.getByTestId("pronunciation-record").click();
      await heading(page, "How much time can you usually spend learning Mandarin?");
      const events = await analyticsEvents(page);
      expect(events.map((event) => event.event)).toContain("onboarding_pronunciation_denied");
    });

    test("7. plan building shows each stage and moves to the plan", async ({ page }) => {
      await setup(page);
      await profile(page, { goal: "school", interests: ["presentations"], level: "simple_sentences" });
      await calibrate(page);
      await page.getByTestId("pronunciation-skip").click();
      await availability(page, "15", "3");
      await heading(page, "We’re adjusting your learning plan to help you learn Mandarin more efficiently.");
      const stages = page.getByTestId("building-stages");
      for (const stage of ["Personalizing your vocabulary", "Adjusting your Mandarin level", "Building your learning plan"]) {
        await expect(stages).toContainText(stage);
      }
      await expect(stages.getByText("(done)")).toHaveCount(3, { timeout: 8000 });
      await heading(page, "Your personalized plan is ready!");
      await heading(page, "Here’s your personalized plan");
    });

    test("8. reduced motion skips decorative animation and finishes sooner", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await setup(page);
      await profile(page, { goal: "everyday", interests: ["hobbies"], level: "few_words" });
      await calibrate(page);
      await page.getByTestId("pronunciation-skip").click();
      await availability(page, "10", "3");
      const started = Date.now();
      await heading(page, "We’re adjusting your learning plan to help you learn Mandarin more efficiently.");
      const animated = await page.evaluate(() =>
        Array.from(document.querySelectorAll("[data-testid=building-stages] span")).some(
          (element) => getComputedStyle(element).animationName !== "none",
        ),
      );
      expect(animated).toBe(false);
      await heading(page, "Here’s your personalized plan");
      expect(Date.now() - started).toBeLessThan(6000);
    });

    test("9. commitment shows the personalized values", async ({ page }) => {
      await setup(page, { account: "user", firstName: "Cameron" });
      await toCommitment(page, { goal: "work", interests: ["meetings"], level: "basic_conversations", minutes: "10", days: "5" });
      await expect(page.getByLabel("Your first name")).toHaveValue("Cameron");
      await expect(page.getByTestId("commitment-statement")).toHaveText("I, Cameron, am ready to begin my Mandarin journey.");
      const card = page.getByTestId("commitment-card");
      await expect(card).toContainText("Your first milestone");
      await expect(page.getByTestId("commitment-milestone")).not.toBeEmpty();
      await expect(card).not.toContainText(/weeks|months/);
      for (const chip of ["Work or business", "10 minutes, 5 days a week", "Add Huahua anytime"]) {
        await expect(card.getByRole("listitem").filter({ hasText: chip })).toBeVisible();
      }
    });

    test("10. paywall receives the completed onboarding context", async ({ page }) => {
      const mocks = await setup(page, { account: "user", firstName: "Cameron" });
      await toCommitment(page, { goal: "work", interests: ["meetings"], level: "basic_conversations", minutes: "10", days: "5" });
      await page.getByTestId("commitment-cta").click();
      if (isMobile(page)) {
        await expect(page.getByRole("heading", { name: "Activate your 10-minute Mandarin plan for work or business" })).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText("Your plan is saved, even if you close this page.").filter({ visible: true }).first()).toBeVisible();
      } else {
        await expect(page.getByRole("heading", { name: "Build useful Mandarin for work or business" })).toBeVisible({ timeout: 15_000 });
        await expect(page.getByText("A focused 10-minute plan built around your goals.").filter({ visible: true }).first()).toBeVisible();
        await expect(page.getByText("Review that adapts to your progress").filter({ visible: true }).first()).toBeVisible();
        const billingSelector = page.getByTestId("desktop-billing-selector");
        await expect(billingSelector.getByRole("button", { name: "Monthly" })).toHaveAttribute("aria-pressed", "true");
        await billingSelector.getByRole("button", { name: "Annual · Save 33%" }).click();
        await expect(billingSelector.getByRole("button", { name: "Annual · Save 33%" })).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByText("Annual membership").filter({ visible: true })).toBeVisible();
        await expect(page.getByText("$79.99 billed yearly").filter({ visible: true })).toBeVisible();
      }
      const committed = mocks.savedStates.find(
        (state) => (state.answers as { commitment?: { committedAt?: string } })?.commitment?.committedAt,
      );
      expect(committed).toBeTruthy();
      expect((committed?.answers as { commitment: { name: unknown } }).commitment.name).toBe("Cameron");
      await page.reload();
      await expect(page.getByRole("heading", {
        name: isMobile(page)
          ? "Activate your 10-minute Mandarin plan for work or business"
          : "Build useful Mandarin for work or business",
      })).toBeVisible({ timeout: 15_000 });
    });

    test("11. no sensitive data reaches logs or analytics", async ({ page }) => {
      const consoleLines: string[] = [];
      page.on("console", (message) => consoleLines.push(message.text()));
      await setup(page, { account: "user" });
      await toCommitment(page, { goal: "everyday", interests: ["friends"], level: "simple_sentences", custom: CUSTOM_INTEREST });
      await page.getByLabel("Your first name").fill("Cameron");
      await page.getByTestId("commitment-cta").click();
      await expect(page.getByTestId("onboarding-step")).toHaveCount(0, { timeout: 15_000 });
      const events = await analyticsEvents(page);
      const names = events.map((event) => event.event);
      for (const name of [
        "onboarding_started",
        "onboarding_goal_selected",
        "onboarding_interests_selected",
        "onboarding_level_selected",
        "onboarding_calibration_completed",
        "onboarding_pronunciation_skipped",
        "onboarding_plan_viewed",
        "onboarding_commitment_completed",
      ]) {
        expect(names).toContain(name);
      }
      const serialized = JSON.stringify(events);
      for (const secret of [CUSTOM_INTEREST, "Zither", "Cameron"]) {
        expect(serialized).not.toContain(secret);
        expect(consoleLines.join("\n")).not.toContain(secret);
      }
    });

    test("12. database errors never lose answers and later saves catch up", async ({ page }) => {
      const mocks = await setup(page, { account: "user", failSaves: 2 });
      await profile(page, { goal: "work", interests: ["meetings"], level: "basic_conversations" });
      await calibrate(page);
      await heading(page, "Want to personalize your speaking practice too?");
      await expect.poll(() => mocks.failedSaves).toBe(2);
      await expect
        .poll(() => {
          const answers = mocks.savedStates[mocks.savedStates.length - 1]?.answers as
            | { goal?: { primary?: string }; calibration?: { placement?: unknown } }
            | undefined;
          return Boolean(answers?.goal?.primary === "work" && answers.calibration?.placement);
        }, { timeout: 15_000 })
        .toBe(true);
      await page.reload();
      await heading(page, "Want to personalize your speaking practice too?");
    });

    test("13. a signed-in learner stays signed in when progress can't be loaded", async ({ page }) => {
      await setup(page, { account: "user" });
      await toCommitment(page, { goal: "work", interests: ["meetings"], level: "few_words" });
      await page.route("**/api/onboarding/progress**", (route) =>
        route.request().method() === "GET"
          ? json(route, { account: { kind: "user", firstName: "Cameron" }, error: "Could not load your progress." }, 500)
          : route.fallback(),
      );
      await page.reload();
      await heading(page, "Ready to begin your Mandarin journey?");
      await expect(page.getByLabel("Your first name")).toHaveValue("Cameron");
    });

    test("accessibility: keyboard, focus, labels, targets and axe", async ({ page }) => {
      await setup(page);
      await page.goto("/onboarding/journey");
      await heading(page, "Why do you want to learn Mandarin?");
      await expect(page.locator("h1")).toBeFocused();

      await page.keyboard.press("Tab");
      await expect(page.getByTestId("goal-work")).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("goal-work")).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("secondary-goal-other")).toHaveCount(0);
      const focusRing = await page.getByTestId("goal-work").evaluate((element) => getComputedStyle(element).outlineStyle);
      expect(focusRing).not.toBe("none");

      const axe = await new AxeBuilder({ page }).include("#onboarding-main").withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(axe.violations.map((violation) => violation.id)).toEqual([]);

      const small = await page.evaluate(() =>
        Array.from(document.querySelectorAll("#onboarding-main button, #onboarding-main input, #onboarding-main select"))
          .map((element) => ({ text: (element.textContent || element.getAttribute("aria-label") || "").trim(), box: element.getBoundingClientRect() }))
          .filter(({ box }) => box.width > 0 && (box.height < 44 || box.width < 44))
          .map(({ text, box }) => `${text} ${Math.round(box.width)}x${Math.round(box.height)}`),
      );
      expect(small).toEqual([]);

      await page.getByTestId("continue").focus();
      await page.keyboard.press("Enter");
      await heading(page, "What would you like to talk about in Mandarin?");
      await expect(page.locator("h1")).toBeFocused();
      await expect(page.getByRole("progressbar", { name: "Onboarding progress" })).toHaveAttribute("aria-valuetext", /Step 2 of/);
      await page.getByTestId("interest-meetings").click();
      await next(page);
      await page.getByTestId("level-simple_sentences").click();
      await next(page);
      await calibrate(page);
      await page.getByTestId("pronunciation-try").click();
      const pronunciationAxe = await new AxeBuilder({ page }).include("#onboarding-main").withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(pronunciationAxe.violations.map((violation) => violation.id)).toEqual([]);
      await expect(page.getByTestId("pronunciation-record")).toBeVisible();
      await page.getByRole("button", { name: "Skip for now" }).click();
      await availability(page, "10", "3");
      await expect(page.getByRole("status").filter({ hasText: /done|ready/ }).first()).toBeAttached({ timeout: 8000 });
      await heading(page, "Here’s your personalized plan");
      const planAxe = await new AxeBuilder({ page }).include("#onboarding-main").withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(planAxe.violations.map((violation) => violation.id)).toEqual([]);
      await next(page);
      await heading(page, "Ready to begin your Mandarin journey?");
      await expect(page.locator("h1")).toBeFocused();
      const commitAxe = await new AxeBuilder({ page }).include("#onboarding-main").withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(commitAxe.violations.map((violation) => violation.id)).toEqual([]);
    });

    test("screenshot: onboarding steps", async ({ page }, testInfo) => {
      await setup(page, { account: "user", firstName: "Cameron" });
      await page.goto("/onboarding/journey");
      await heading(page, "Why do you want to learn Mandarin?");
      await page.getByTestId("goal-work").click();
      await page.screenshot({ path: testInfo.outputPath(`goal-${viewport.name}.png`), fullPage: true });
      await next(page);
      await page.getByTestId("interest-meetings").click();
      await next(page);
      await page.getByTestId("level-basic_conversations").click();
      await next(page);
      await calibrate(page);
      await page.getByTestId("pronunciation-skip").click();
      await availability(page, "10", "5");
      await heading(page, "Here’s your personalized plan");
      await page.screenshot({ path: testInfo.outputPath(`plan-${viewport.name}.png`), fullPage: true });
      await next(page);
      await heading(page, "Ready to begin your Mandarin journey?");
      await page.screenshot({ path: testInfo.outputPath(`commitment-${viewport.name}.png`), fullPage: true });
    });
  });
}
