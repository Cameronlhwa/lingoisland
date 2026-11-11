import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

// Every server call is mocked: nothing here reaches Supabase, Telnyx, SpeechSuper or Stripe.

type Channel = "sms" | "whatsapp";
type VerifyMode = "ok" | "incorrect_then_ok" | "transfer";

type MockOptions = {
  account?: "guest" | "user";
  firstName?: string | null;
  smsAvailable?: boolean;
  whatsappAvailable?: boolean;
  eligibility?: { smsSupported: boolean; whatsappAvailable: boolean; country?: string };
  verify?: VerifyMode;
  /** The first N progress saves fail with a database error. */
  failSaves?: number;
  /** Sending the verification code fails at the messaging provider. */
  sendFails?: boolean;
};

type Mocks = {
  savedStates: Array<Record<string, unknown>>;
  requests: Array<{ url: string; body: string }>;
  checkoutBodies: Array<Record<string, unknown>>;
  verifyBodies: Array<Record<string, unknown>>;
  failedSaves: number;
};

const PHONE_INPUT = "2025550123";
const CODE = "123456";
const CUSTOM_INTEREST = "Zither duets";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "medium", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

function phoneState(input: { pending?: Channel | null; contact?: Channel | null }) {
  const now = Date.now();
  return {
    available: true,
    supportedCountries: [{ code: "US", dialCode: "+1" }],
    consentVersion: "2026-11-07",
    lingoNumber: null,
    whatsapp: { available: true, supportedCountries: [] },
    contact: input.contact
      ? {
          status: "active",
          channel: input.contact,
          maskedNumber: "(•••) •••-0123",
          countryCode: "US",
          verifiedAt: new Date(now).toISOString(),
          consentAt: new Date(now).toISOString(),
          welcomeSentAt: null,
          pausedAt: null,
          pausedReason: null,
          optedOutAt: null,
          disabledAt: null,
          hasDeliveryIssue: false,
        }
      : null,
    pending: input.pending
      ? {
          maskedNumber: "(•••) •••-0123",
          channel: input.pending,
          expiresAt: new Date(now + 600_000).toISOString(),
          expired: false,
          attemptsRemaining: 5,
          sendsRemaining: 3,
          resendAvailableAt: new Date(now - 1000).toISOString(),
          deliveryFailed: false,
        }
      : null,
  };
}

async function setup(page: Page, options: MockOptions = {}): Promise<Mocks> {
  const mocks: Mocks = { savedStates: [], requests: [], checkoutBodies: [], verifyBodies: [], failedSaves: 0 };
  const account = options.account ?? "guest";
  let stored: Record<string, unknown> | null = null;
  let revision = 0;
  let pending: Channel | null = null;
  let contact: Channel | null = null;
  let verifyCalls = 0;

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
  await page.route("**/api/onboarding/messaging/eligibility", async (route) => {
    if (route.request().method() === "GET") {
      return json(route, {
        smsAvailable: options.smsAvailable ?? true,
        whatsappAvailable: options.whatsappAvailable ?? true,
        simulationAvailable: false,
      });
    }
    const eligibility = options.eligibility ?? { smsSupported: true, whatsappAvailable: true };
    const channels: Array<{ channel: Channel; recommended: boolean }> = [];
    if (eligibility.smsSupported) channels.push({ channel: "sms", recommended: false });
    if (eligibility.whatsappAvailable) channels.push({ channel: "whatsapp", recommended: !eligibility.smsSupported });
    return json(route, {
      valid: true,
      country: eligibility.country ?? "US",
      smsSupported: eligibility.smsSupported,
      whatsappAvailable: eligibility.whatsappAvailable,
      recommendation: !eligibility.smsSupported ? (eligibility.whatsappAvailable ? "whatsapp" : "none") : eligibility.whatsappAvailable ? "choose" : "sms",
      options: channels,
      simulationAvailable: false,
    });
  });
  await page.route("**/api/onboarding/pronunciation", (route) => json(route, { status: "ok", needsToneSupport: false }));
  await page.route("**/api/onboarding/huahua-preferences", (route) => json(route, { status: "saved" }));
  await page.route("**/api/onboarding/huahua-preview", async (route) => {
    if (route.request().method() === "POST") return json(route, { status: "sent", channel: contact ?? "sms" });
    return json(route, {
      thread: { stage: "done", open: false },
      preferences: { support: "on_request", correction: "balanced", frequency: "3" },
      messages: [
        { direction: "outbound", body: "Hi! I'm Huahua, your Mandarin practice buddy from LingoIsland.", at: new Date().toISOString(), status: "delivered" },
        { direction: "inbound", body: "1", at: new Date().toISOString(), status: "received" },
      ],
    });
  });
  await page.route("**/api/sms/phone", (route) => json(route, phoneState({ pending, contact })));
  await page.route("**/api/sms/phone/start", async (route) => {
    const body = route.request().postDataJSON() as { channel: Channel };
    if (options.sendFails) {
      return json(route, { error: "We couldn't text that number. Check it and try again.", code: "send_failed" }, 502);
    }
    pending = body.channel;
    return json(route, phoneState({ pending, contact }));
  });
  await page.route("**/api/sms/phone/verify", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    mocks.verifyBodies.push(body);
    verifyCalls += 1;
    const mode = options.verify ?? "ok";
    if (mode === "incorrect_then_ok" && verifyCalls === 1) {
      return json(route, { error: "That code isn't right.", code: "incorrect_code", attemptsRemaining: 4 }, 400);
    }
    if (mode === "transfer" && body.confirmTransfer !== true) {
      return json(route, { error: "This number is connected to another account.", code: "transfer_required" }, 409);
    }
    contact = pending;
    pending = null;
    return json(route, { ...phoneState({ pending, contact }), transferred: mode === "transfer" });
  });
  await page.route("**/api/entitlements**", (route) => json(route, { isPro: false, products: [] }));
  await page.route("**/api/stripe/checkout", async (route) => {
    mocks.checkoutBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    return json(route, { error: "Mock checkout" }, 500);
  });
  return mocks;
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
  await heading(page, "Which situations do you want to handle first?");
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
  await pains(page, input.level);
}

/** Experience (skipped for complete beginners), using pain + timing, then learning pain or hesitation. */
async function pains(page: Page, level: string) {
  if (level !== "new") {
    await heading(page, "How long have you been learning Mandarin?");
    await page.getByTestId("experience-on_and_off").click();
    await next(page);
  }
  await heading(page, /what usually happens/);
  await page.locator("[data-testid^=pain-]").first().click();
  await page.getByTestId("timing-ongoing").click();
  await next(page);
  await heading(page, /hardest about learning so far|held you back from starting/);
  await page.locator("[data-testid^=learning-pain-], [data-testid^=hesitation-]").first().click();
  await next(page);
}

const PRONUNCIATION_HEADING = /Check your tones in 20 seconds|Say your first word in Mandarin/;

/** After the building screen: confirm the reflection to reach commitment. */
async function confirmReflection(page: Page) {
  await heading(page, /^From .+ in \d+ weeks$/);
  await page.getByTestId("reflect-confirm").filter({ visible: true }).click();
}

async function calibrate(page: Page, { beginner = false }: { beginner?: boolean } = {}) {
  const questionCounter = (position: number) =>
    page.getByTestId("onboarding-step").getByText(`Question ${position} of 5`);
  await heading(page, /like you learn with LingoIsland|started from zero|felt stuck too/);
  await page.getByTestId("social-proof-continue").click();
  if (beginner) {
    await heading(page, PRONUNCIATION_HEADING);
    return;
  }
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
  await heading(page, PRONUNCIATION_HEADING);
}

async function availability(page: Page, minutes = "10", days = "5") {
  await heading(page, "How much time can you usually spend learning Mandarin?");
  await page.getByTestId(`minutes-${minutes}`).click();
  await page.getByTestId(`days-${days}`).click();
  if (Number(minutes) >= 30 || minutes.startsWith("60")) await page.getByTestId("session-auto").click();
  await next(page);
}

type ProfileInput = { goal: string; interests: string[]; level: string; custom?: string; minutes?: string; days?: string };

/** Through reflection, landing on the Huahua intro. */
async function toPlan(page: Page, input: ProfileInput) {
  await profile(page, input);
  await calibrate(page, { beginner: input.level === "new" });
  await page.getByTestId("pronunciation-skip").click();
  await availability(page, input.minutes, input.days);
  await confirmReflection(page);
  await heading(page, "Meet Huahua, your Mandarin practice buddy");
}

async function toMessaging(page: Page, input: ProfileInput) {
  await toPlan(page, input);
  await page.getByTestId("huahua-setup").click();
}

async function enterNumber(page: Page) {
  await heading(page, "Where should Huahua message you?");
  await expect(page.locator("#messaging-country option").nth(5)).toBeAttached();
  await page.locator("#messaging-country").selectOption("US");
  await page.getByTestId("messaging-phone").fill(PHONE_INPUT);
  await page.getByTestId("messaging-check").click();
}

async function consentAndSend(page: Page) {
  await expect(page.getByTestId("messaging-send-code")).toBeDisabled();
  await page.getByTestId("consent-scheduled").check();
  await page.getByTestId("consent-journey").check();
  await expect(page.getByTestId("messaging-disclosure")).toContainText("Huahua is an AI");
  await page.getByTestId("messaging-send-code").click();
  await heading(page, "Enter your code");
}

async function enterCode(page: Page) {
  await page.locator("#sms-code").fill(CODE);
  await page.getByRole("button", { name: "Verify" }).click();
}

async function toCommitment(page: Page, input: ProfileInput) {
  await toPlan(page, input);
  await page.getByTestId("huahua-skip").click();
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

    test("1. absolute beginner goes from reflection through Huahua skip to the paywall", async ({ page }) => {
      await setup(page);
      await profile(page, { goal: "everyday", interests: ["food"], level: "new" });
      await calibrate(page, { beginner: true });
      await expect(page.getByTestId("calibration-start")).toHaveCount(0);
      await heading(page, "Say your first word in Mandarin");
      await page.getByTestId("pronunciation-skip").click();
      await availability(page, "5", "3");
      await confirmReflection(page);
      await heading(page, "Meet Huahua, your Mandarin practice buddy");
      await page.getByTestId("huahua-skip").click();
      await heading(page, "Ready to begin your Mandarin journey?");
      await page.getByTestId("commitment-cta").click();
      await expect(page.getByTestId("conversation-paywall")).toBeVisible({ timeout: 15_000 });
    });

    test("2. business learner completes SMS setup", async ({ page }, testInfo) => {
      const mocks = await setup(page, { account: "user", firstName: "Cameron" });
      await toMessaging(page, { goal: "work", interests: ["meetings", "clients"], level: "basic_conversations" });
      await enterNumber(page);
      await heading(page, "How should Huahua message you?");
      await page.getByTestId("channel-sms").click();
      await consentAndSend(page);
      await enterCode(page);
      await heading(page, "When should Huahua stay quiet?");
      await expect(page.getByTestId("quiet-hours-summary")).toContainText("9:00 PM to 8:00 AM");
      await page.screenshot({ path: testInfo.outputPath(`quiet-hours-${viewport.name}.png`), fullPage: true });
      await next(page);
      await heading(page, "Try a free chat with Huahua");
      await expect(page.getByTestId("preview-live-status")).toContainText("Preview finished");
      await next(page);
      await heading(page, "Ready to begin your Mandarin journey?");
      await expect(page.getByTestId("commitment-card")).toContainText("Huahua by text, 3 times a week");
      const start = mocks.requests.find((request) => request.url.endsWith("/api/sms/phone/start"));
      expect(JSON.parse(start?.body ?? "{}")).toMatchObject({ channel: "sms", consentScheduled: true, consentJourney: true, source: "onboarding" });
      const saved = mocks.requests.find((request) => request.url.endsWith("/api/onboarding/huahua-preferences"));
      expect(Object.keys(JSON.parse(saved?.body ?? "{}").prefs ?? {})).toContain("quietStart");
    });

    test("3. learner without a supported channel can skip messaging", async ({ page }) => {
      await setup(page, { account: "user", smsAvailable: false, whatsappAvailable: false });
      await toMessaging(page, { goal: "travel", interests: ["restaurants"], level: "few_words" });
      await heading(page, "Huahua messaging isn’t available yet");
      await page.getByTestId("messaging-continue-unavailable").click();
      await heading(page, "Ready to begin your Mandarin journey?");
      await expect(page.getByTestId("commitment-card")).toContainText("Add Huahua anytime");
    });

    test("4. returning learner resumes where they left off", async ({ page }) => {
      await setup(page);
      await profile(page, { goal: "heritage", interests: ["family_conversations"], level: "few_words" });
      await heading(page, "Heritage learners like you learn with LingoIsland");
      await page.reload();
      await heading(page, "Heritage learners like you learn with LingoIsland");
      await page.getByRole("button", { name: "Back" }).click();
      await heading(page, "What’s been hardest about learning so far?");
      await expect(page.getByTestId("learning-pain-forget_words")).toHaveAttribute("aria-pressed", "true");
    });

    test("reviews after the pain questions show the site rating and match the learner", async ({ page }, testInfo) => {
      await setup(page);
      await profile(page, { goal: "work", interests: ["finance"], level: "few_words" });
      await heading(page, "Professionals like you learn with LingoIsland");
      await expect(page.getByTestId("site-rating")).toContainText("Rated 4.7 out of 5");
      await expect(page.getByText("Based on reviews from LingoIsland learners on our website.", { exact: true })).toBeVisible();
      await expect(page.getByText(/App Store|Google Play/)).toHaveCount(0);
      const reviews = page.getByTestId("social-proof-review");
      await expect(reviews).toHaveCount(3);
      await expect(reviews.first()).toContainText("Finance professional");
      await expect(reviews.first().getByTestId("social-proof-reason")).toHaveText("Also learning for work");
      await expect(page.getByText("Traveler", { exact: true })).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`reviews-${viewport.name}.png`), fullPage: true });
      const axe = await new AxeBuilder({ page }).include("#onboarding-main").withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(axe.violations.map((violation) => violation.id)).toEqual([]);

      await page.getByTestId("social-proof-continue").click();
      await heading(page, "Let’s personalize your starting point");
      await page.getByRole("button", { name: "Back" }).click();
      await heading(page, "Professionals like you learn with LingoIsland");
      await page.getByRole("button", { name: "Back" }).click();
      await heading(page, "What’s been hardest about learning so far?");
    });

    test("a traveler sees the traveler review first", async ({ page }) => {
      await setup(page);
      await profile(page, { goal: "travel", interests: ["restaurants"], level: "new" });
      await heading(page, "Others who started from zero");
      const first = page.getByTestId("social-proof-review").first();
      await expect(first).toContainText("Traveler");
      await expect(first.getByTestId("social-proof-reason")).toHaveText("Also wanted to talk with locals");
    });

    test("calibration advances automatically and lets learners revise answers", async ({ page }) => {
      await setup(page);
      await profile(page, { goal: "everyday", interests: ["food"], level: "few_words" });
      await calibrate(page);
    });

    test("5. changing an earlier answer updates the plan", async ({ page }) => {
      await setup(page);
      await toPlan(page, { goal: "work", interests: ["sales"], level: "simple_sentences", minutes: "10", days: "3" });
      await page.getByRole("button", { name: "Back" }).click();
      await heading(page, /^From .+ in \d+ weeks$/);
      await page.getByRole("button", { name: "Back" }).click();
      await heading(page, "How much time can you usually spend learning Mandarin?");
      await page.getByTestId("minutes-30").click();
      await page.getByTestId("session-short_sessions").click();
      await next(page);
      await confirmReflection(page);
      await heading(page, "Meet Huahua, your Mandarin practice buddy");
      await page.getByTestId("huahua-skip").click();
      await heading(page, "Ready to begin your Mandarin journey?");
      await expect(page.getByText(/30 minutes, 3 days a week/)).toBeVisible();
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
      await calibrate(page, { beginner: true });
      await page.getByTestId("pronunciation-try").click();
      await expect(page.getByTestId("pronunciation-record")).toHaveAccessibleName(/Record yourself saying/);
      await page.getByTestId("pronunciation-record").click();
      await heading(page, "How much time can you usually spend learning Mandarin?");
      const events = await analyticsEvents(page);
      expect(events.map((event) => event.event)).toContain("onboarding_pronunciation_denied");
    });

    test("7. plan building shows each stage and moves to reflection", async ({ page }) => {
      await setup(page);
      await profile(page, { goal: "school", interests: ["presentations"], level: "simple_sentences" });
      await calibrate(page);
      await page.getByTestId("pronunciation-skip").click();
      await availability(page, "15", "3");
      await heading(page, "We’re adjusting your learning plan to help you learn Mandarin more efficiently.");
      const stages = page.getByTestId("building-stages");
      for (const stage of ["Focusing on presentations", "Matching your starting point", "Fitting it into 15 minutes, 3 days a week"]) {
        await expect(stages).toContainText(stage);
      }
      await expect(stages.getByText("(done)")).toHaveCount(3, { timeout: 8000 });
      await heading(page, "Your personalized plan is ready!");
      await confirmReflection(page);
      await heading(page, "Meet Huahua, your Mandarin practice buddy");
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
      await heading(page, /^From .+ in \d+ weeks$/);
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
      await expect(page.getByRole("heading", { name: "Mandarin that fits your workday." }).filter({ visible: true })).toBeVisible({ timeout: 15_000 });
      const card = page.getByTestId("conversation-paywall");
      await expect(card.getByTestId("conversation-comparison")).toContainText("LingoIsland");
      await expect(card.getByTestId("conversation-comparison")).toContainText(/meeting|progress/i);
      await expect(card.getByRole("list", { name: "Membership benefits" }).getByRole("listitem")).toHaveCount(2);
      await expect(card).toContainText("Billed monthly. Cancel anytime.");
      await expect(page.getByText(/Huahua|Journeys/).filter({ visible: true })).toHaveCount(0);
      const committed = mocks.savedStates.find(
        (state) => (state.answers as { commitment?: { committedAt?: string } })?.commitment?.committedAt,
      );
      expect(committed).toBeTruthy();
      expect((committed?.answers as { commitment: { name: unknown } }).commitment.name).toBe("Cameron");
      await page.reload();
      await expect(page.getByRole("heading", { name: "Mandarin that fits your workday." }).filter({ visible: true })).toBeVisible({ timeout: 15_000 });
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
        "onboarding_experience_selected",
        "onboarding_using_pain_selected",
        "onboarding_learning_pain_selected",
        "onboarding_reviews_viewed",
        "onboarding_calibration_completed",
        "onboarding_pronunciation_skipped",
        "onboarding_reflection_confirmed",
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
      await heading(page, PRONUNCIATION_HEADING);
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
      await expect(page.getByText("Anything else? (optional)")).toHaveCount(0);
      const focusRing = await page.getByTestId("goal-work").evaluate((element) => getComputedStyle(element).outlineStyle);
      expect(focusRing).not.toBe("none");
      await page.getByTestId("goal-travel").click();
      await expect(page.getByTestId("goal-travel")).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("goal-work")).toHaveAttribute("aria-pressed", "true");

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
      await heading(page, "Which situations do you want to handle first?");
      await expect(page.locator("h1")).toBeFocused();
      await expect(page.getByRole("progressbar", { name: "Onboarding progress" })).toHaveAttribute("aria-valuetext", /Step 2 of/);
      await page.getByTestId("interest-meetings").click();
      await next(page);
      await page.getByTestId("level-simple_sentences").click();
      await next(page);
      await pains(page, "simple_sentences");
      const painAxe = await new AxeBuilder({ page }).include("#onboarding-main").withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(painAxe.violations.map((violation) => violation.id)).toEqual([]);
      await calibrate(page);
      await page.getByTestId("pronunciation-try").click();
      const pronunciationAxe = await new AxeBuilder({ page }).include("#onboarding-main").withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(pronunciationAxe.violations.map((violation) => violation.id)).toEqual([]);
      await expect(page.getByTestId("pronunciation-record")).toBeVisible();
      await page.getByRole("button", { name: "Skip for now" }).click();
      await availability(page, "10", "3");
      await expect(page.getByRole("status").filter({ hasText: /done|ready/ }).first()).toBeAttached({ timeout: 8000 });
      await heading(page, /^From .+ in \d+ weeks$/);
      const reflectAxe = await new AxeBuilder({ page }).include("#onboarding-main").withTags(["wcag2a", "wcag2aa"]).analyze();
      expect(reflectAxe.violations.map((violation) => violation.id)).toEqual([]);
      await page.getByTestId("reflect-confirm").filter({ visible: true }).click();
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
      await pains(page, "basic_conversations");
      await calibrate(page);
      await page.getByTestId("pronunciation-skip").click();
      await availability(page, "10", "5");
      await confirmReflection(page);
      await heading(page, "Ready to begin your Mandarin journey?");
      await page.screenshot({ path: testInfo.outputPath(`commitment-${viewport.name}.png`), fullPage: true });
    });
  });
}
