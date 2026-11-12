import { mockMiniLessonFlag } from "./helpers/onboardingExperiment";
import { finishFirstLesson, advanceLesson } from "./helpers/firstLesson";
import { readFileSync } from "node:fs";
import { expect, test, type BrowserContext, type Locator, type Page, type Route } from "@playwright/test";

// Stress tests for onboarding and the hand-off to Stripe Checkout. Stripe,
// Supabase auth, our onboarding APIs and analytics are mocked in the browser,
// so no charge, account, message or database row is created. The API checks at
// the end only send requests the server refuses before Stripe or the database.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  readFileSync(".env.local", "utf8").match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim() ??
  "";
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const STRIPE_URL = "https://checkout.stripe.com/c/pay/cs_test_e2e_stress";
const LOCAL_KEY = "lingo_onboarding_v2";

const USER = {
  id: "00000000-0000-4000-8000-0000000000e3",
  aud: "authenticated",
  role: "authenticated",
  email: "stress-e2e@example.com",
  is_anonymous: false,
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};

type Reply = { status: number; body?: unknown; html?: string } | "abort" | "hang";

type Options = {
  signedIn?: boolean;
  pro?: boolean;
  entitlementsDelayMs?: number;
  checkoutDelayMs?: number;
  /** Replies for successive checkout requests; later requests succeed. */
  checkoutReplies?: Reply[];
  stripeDelayMs?: number;
  insightDelayMs?: number;
  /** Progress saves: delay, and which save numbers (1-based) fail. */
  saveDelayMs?: number;
  failSave?: (n: number) => boolean;
  /** Every save answers 409 with the first saved state. */
  alwaysConflict?: boolean;
  saveEmail?: Reply;
};

type Mocks = {
  checkoutBodies: Array<Record<string, unknown>>;
  puts: number;
  savedStates: Array<Record<string, unknown>>;
  pageErrors: string[];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function reply(route: Route, value: Reply) {
  if (value === "abort") return route.abort("failed");
  if (value === "hang") return; // never answered
  if (value.html !== undefined) return route.fulfill({ status: value.status, contentType: "text/html", body: value.html });
  return json(route, value.body ?? {}, value.status);
}

async function signIn(context: BrowserContext) {
  const now = Math.floor(Date.now() / 1000);
  const session = {
    access_token: "e2e-access-token",
    refresh_token: "e2e-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    user: USER,
  };
  await context.addCookies([
    { name: `sb-${PROJECT_REF}-auth-token`, value: encodeURIComponent(JSON.stringify(session)), url: "http://localhost:3002" },
  ]);
}

/** Mocks live on the context so every tab in a test shares one fake server. */
async function setup(page: Page, options: Options = {}): Promise<Mocks> {
  const context = page.context();
  const mocks: Mocks = { checkoutBodies: [], puts: 0, savedStates: [], pageErrors: [] };
  let stored: Record<string, unknown> | null = null;
  let firstSaved: Record<string, unknown> | null = null;
  let revision = 0;

  if (options.signedIn) await signIn(context);
  const watch = (target: Page) => target.on("pageerror", (error) => mocks.pageErrors.push(error.message));
  watch(page);
  context.on("page", watch);

  await context.route(/posthog\.com/, (route) => route.abort());
  await context.route(`${SUPABASE_URL}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/auth/v1/user" && options.signedIn) return json(route, USER);
    return json(route, { message: "Not mocked" }, 401);
  });
  await context.route("**/api/onboarding/first-lesson", route => route.fulfill({ json: { lesson: null } }));
  await context.route("**/api/onboarding/progress**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      return json(route, {
        account: { kind: options.signedIn ? "user" : "guest", firstName: options.signedIn ? "Cameron" : null },
        progress: stored,
      });
    }
    mocks.puts += 1;
    const n = mocks.puts;
    if (options.saveDelayMs) await sleep(options.saveDelayMs);
    if (options.failSave?.(n)) return json(route, { error: "Could not save your progress." }, 500);
    const body = request.postDataJSON() as { state: Record<string, unknown>; expectedRevision: number | null };
    if (options.alwaysConflict && firstSaved) return json(route, { status: "conflict", progress: firstSaved }, 409);
    if (stored && body.expectedRevision !== revision) return json(route, { status: "conflict", progress: stored }, 409);
    mocks.savedStates.push(body.state);
    revision += 1;
    stored = { ...body.state, revision, updatedAt: new Date().toISOString(), activatedAt: null };
    firstSaved ??= stored;
    return json(route, { status: "saved", progress: stored });
  });
  await context.route("**/api/onboarding/abandon", (route) => json(route, { status: "ok" }));
  await context.route("**/api/onboarding/insight", async (route) => {
    if (options.insightDelayMs) await sleep(options.insightDelayMs);
    return json(route, { error: "Mocked: template used" }, 503);
  });
  await context.route("**/api/onboarding/save-email", (route) => reply(route, options.saveEmail ?? { status: 200, body: { ok: true } }));
  await context.route("**/api/profile**", (route) => json(route, { error: "Unauthorized" }, 401));
  await context.route("**/api/entitlements**", async (route) => {
    if (options.entitlementsDelayMs) await sleep(options.entitlementsDelayMs);
    return json(route, { plan: options.pro ? "pro" : "free", isIslandsPro: Boolean(options.pro), isHskPro: false });
  });
  await context.route("**/api/stripe/reconcile", (route) => json(route, { status: "ok" }));
  await context.route("**/api/stripe/checkout", async (route) => {
    mocks.checkoutBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    if (options.checkoutDelayMs) await sleep(options.checkoutDelayMs);
    const planned = options.checkoutReplies?.[mocks.checkoutBodies.length - 1];
    return reply(route, planned ?? { status: 200, body: { url: STRIPE_URL } });
  });
  await context.route("https://checkout.stripe.com/**", async (route) => {
    if (options.stripeDelayMs) await sleep(options.stripeDelayMs);
    return route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Mock Stripe Checkout</h1>" });
  });
  await mockMiniLessonFlag(page);
  return mocks;
}

async function heading(page: Page, name: string | RegExp, timeout = 15_000) {
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({ timeout });
}

type Press = (target: Locator) => Promise<void>;
const click: Press = (target) => target.click();
const doubleClick: Press = (target) => target.dblclick();

/** One step of the flow for a working professional with a few words of Mandarin. */
type Step = { name: string; heading: string | RegExp; act: (page: Page, press: Press) => Promise<void> };

const STEPS: Step[] = [
  {
    name: "goal",
    heading: "Why do you want to learn Mandarin?",
    act: async (page, press) => {
      await page.getByTestId("goal-work").click();
      await press(page.getByTestId("continue"));
    },
  },
  {
    name: "interests",
    heading: "Which situations do you want to handle first?",
    act: async (page, press) => {
      await page.getByTestId("interest-meetings").click();
      await press(page.getByTestId("continue"));
    },
  },
  {
    name: "level",
    heading: "How does your Mandarin feel right now?",
    act: async (page, press) => {
      await page.getByTestId("level-few_words").click();
      await press(page.getByTestId("continue"));
    },
  },
  {
    name: "vocab_basic",
    heading: "Which of these words do you recognize?",
    act: async (page, press) => {
      await page.getByTestId("vocab-none-known").click();
      await press(page.getByTestId("vocab-continue"));
    },
  },
  {
    name: "vocab_advanced",
    heading: "What about these more advanced words?",
    act: async (page, press) => {
      await page.getByTestId("vocab-none-known").click();
      await press(page.getByTestId("vocab-continue"));
    },
  },
  {
    name: "experience",
    heading: "How long have you been learning Mandarin?",
    act: async (page, press) => {
      await page.getByTestId("experience-on_and_off").click();
      await press(page.getByTestId("continue"));
    },
  },
  {
    name: "using_pain",
    heading: /what usually happens/,
    act: async (page, press) => {
      await page.getByTestId("pain-stay_quiet").click();
      await page.getByTestId("timing-ongoing").click();
      await press(page.getByTestId("continue"));
    },
  },
  {
    name: "learning_pain",
    heading: "What’s been hardest about learning so far?",
    act: async (page, press) => {
      await page.getByTestId("learning-pain-not_relevant").click();
      await press(page.getByTestId("continue"));
    },
  },
  {
    name: "reviews",
    heading: /like you learn with LingoIsland/,
    act: async (page, press) => press(page.getByTestId("social-proof-continue")),
  },
  {
    name: "availability",
    heading: "How much time can you usually spend learning Mandarin?",
    act: async (page, press) => {
      await page.getByTestId("minutes-10").click();
      await page.getByTestId("days-5").click();
      await press(page.getByTestId("continue"));
    },
  },
  {
    name: "reflect",
    heading: /^From .+ in \d+ weeks$/,
    act: async (page, press) => press(page.getByTestId("reflect-confirm").filter({ visible: true })),
  },
  {
    name: "first_lesson",
    heading: /Order your first|Reply to your first|Share an interest|Make a polite|Set a clear|Make a friendly|Adjust a reservation|Clarify a detail|Express a more|Negotiate an alternative|Raise a concern|Frame your perspective/,
    act: async (page, press) => finishFirstLesson(page, press),
  },
  {
    name: "commitment",
    heading: "Ready to continue your Mandarin journey?",
    act: async (page, press) => {
      await page.getByLabel("Your first name").fill("Cameron");
      await press(page.getByTestId("commitment-cta"));
    },
  },
];

function paywallCta(page: Page) {
  return page.getByRole("button", { name: /^(Start learning Mandarin|Start my plan|Activate my plan|Start my Mandarin plan|Starting checkout)/ }).filter({ visible: true }).first();
}

async function walk(page: Page, options: { press?: Press; from?: string; until?: string; each?: (step: Step) => Promise<void> } = {}) {
  const first = options.from ? STEPS.findIndex((step) => step.name === options.from) : 0;
  for (const step of STEPS.slice(first)) {
    if (step.name === options.until) return;
    await heading(page, step.heading, 20_000);
    // Wait out the nav lock so a real Continue isn't blocked after the previous step.
    await expect(page.getByTestId("onboarding-step")).toHaveAttribute("data-nav-ready", "true", { timeout: 5_000 });
    await options.each?.(step);
    await step.act(page, options.press ?? click);
  }
}

async function toPaywall(page: Page, press?: Press) {
  await page.goto("/onboarding/journey");
  await walk(page, { press });
  await expect(paywallCta(page)).toBeVisible({ timeout: 15_000 });
  await expect(paywallCta(page)).toBeEnabled();
}

/** Real mouse clicks at the button's position, like an impatient person tapping. */
async function tapBurst(page: Page, target: Locator, times: number, gapMs: number) {
  const box = await target.boundingBox();
  if (!box) throw new Error("button not visible");
  for (let index = 0; index < times; index += 1) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => undefined);
    await page.waitForTimeout(gapMs);
  }
}

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

// ---------------------------------------------------------------------------
// Payment
// ---------------------------------------------------------------------------

for (const viewport of VIEWPORTS) {
  test.describe(`stress: payment (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });
    test.describe.configure({ timeout: 120_000 });

    test("a burst of taps on the paywall button opens one checkout session", async ({ page }) => {
      const mocks = await setup(page, { signedIn: true, entitlementsDelayMs: 900, checkoutDelayMs: 600 });
      await toPaywall(page);
      await tapBurst(page, paywallCta(page), 6, 120);
      await page.waitForURL(STRIPE_URL, { timeout: 20_000 });
      expect(mocks.checkoutBodies, "checkout sessions requested").toHaveLength(1);
    });

    test("tapping again while Stripe is loading does not open a second session", async ({ page }) => {
      const mocks = await setup(page, { signedIn: true, stripeDelayMs: 4_000 });
      await toPaywall(page);
      const box = await paywallCta(page).boundingBox();
      await paywallCta(page).click();
      await expect.poll(() => mocks.checkoutBodies.length).toBe(1);
      for (let index = 0; index < 8 && box; index += 1) {
        await page.waitForTimeout(250);
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => undefined);
      }
      await page.waitForURL(STRIPE_URL, { timeout: 20_000 });
      expect(mocks.checkoutBodies, "checkout sessions requested").toHaveLength(1);
    });

    for (const [label, failure, message] of [
      ["network failure", "abort", /Could not start checkout/],
      ["HTML error page", { status: 502, html: "<h1>Bad gateway</h1>" }, /Could not start checkout/],
      ["success without a URL", { status: 200, body: {} }, /Could not start checkout/],
      ["server error", { status: 500, body: { error: "Stripe price not configured" } }, /Stripe price not configured/],
    ] as const) {
      test(`checkout ${label}: shows a message and the retry reaches Stripe`, async ({ page }) => {
        const mocks = await setup(page, { signedIn: true, checkoutReplies: [failure as Reply] });
        await toPaywall(page);
        await paywallCta(page).click();
        await expect(page.getByText(message).filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });
        await expect(paywallCta(page)).toBeEnabled();
        expect(page.url()).toContain("/onboarding/journey");
        await paywallCta(page).click();
        await page.waitForURL(STRIPE_URL, { timeout: 15_000 });
        expect(mocks.checkoutBodies).toHaveLength(2);
        expect(mocks.pageErrors).toEqual([]);
      });
    }

    test("a checkout request that never answers leaves the learner a way out", async ({ page }) => {
      await setup(page, { signedIn: true, checkoutReplies: ["hang"] });
      await toPaywall(page);
      await paywallCta(page).click();
      await expect(paywallCta(page)).toHaveText(/Starting checkout/);
      await expect(page.getByText("Checkout is taking too long to open. Please try again.").filter({ visible: true }).first()).toBeVisible({
        timeout: 20_000,
      });
      await expect(paywallCta(page)).toBeEnabled();
      await expect(paywallCta(page)).not.toHaveText(/Starting checkout/);
    });

    test("an account that subscribed in another tab is sent to activation (409)", async ({ page }) => {
      const mocks = await setup(page, { signedIn: true, checkoutReplies: [{ status: 409, body: { error: "Already subscribed to Islands" } }] });
      const appRequests: string[] = [];
      await page.route(
        (url) => url.pathname === "/app/onboarding",
        (route) => {
          appRequests.push(route.request().url());
          return route.fulfill({ status: 200, contentType: "text/html", body: "<h1>App</h1>" });
        },
      );
      await toPaywall(page);
      await paywallCta(page).click();
      await expect.poll(() => appRequests.some((url) => url.includes("activate=1")), { timeout: 15_000 }).toBe(true);
      expect(mocks.checkoutBodies).toHaveLength(1);
    });

    test("a resumed annual offer displays and charges the same interval", async ({ page }) => {
      const mocks = await setup(page, { signedIn: true });
      await toPaywall(page);
      await page.goto("/onboarding/journey?resume=paywall&plan=yearly");
      await expect(page.getByTestId("conversation-price")).toContainText("$79.99 billed yearly");
      await paywallCta(page).click();
      await page.waitForURL(STRIPE_URL, { timeout: 15_000 });
      expect(mocks.checkoutBodies[0]?.interval).toBe("yearly");
    });

    test("coming back from Stripe with the browser Back button can check out again", async ({ page }) => {
      const mocks = await setup(page, { signedIn: true });
      await toPaywall(page);
      await paywallCta(page).click();
      await page.waitForURL(STRIPE_URL, { timeout: 15_000 });
      await page.goBack();
      await expect(paywallCta(page)).toBeVisible({ timeout: 15_000 });
      await expect(paywallCta(page)).toBeEnabled();
      await expect(paywallCta(page)).not.toHaveText(/Starting checkout/);
      await paywallCta(page).click();
      await page.waitForURL(STRIPE_URL, { timeout: 15_000 });
      expect(mocks.checkoutBodies).toHaveLength(2);
    });

    test("tampered cancel URLs still show a working paywall", async ({ page }) => {
      const mocks = await setup(page, { signedIn: true });
      await toPaywall(page);
      for (const [query, annual] of [
        ["canceled=1&plan=%3Cscript%3Ealert(1)%3C%2Fscript%3E", false],
        ["canceled=1&plan=annual", true],
        ["canceled=1", false],
        ["canceled=1&plan=yearly&plan=monthly", true],
        ["resume=paywall&canceled=1&plan=yearly&autoCheckout=0", true],
      ] as const) {
        await page.goto(`/onboarding/journey?${query}`);
        await expect(paywallCta(page), query).toBeVisible({ timeout: 15_000 });
        await expect(page.getByTestId("conversation-price"), query).toContainText(annual ? "$79.99 billed yearly" : "Billed monthly.");
      }
      expect(mocks.checkoutBodies).toEqual([]);
      expect(mocks.pageErrors).toEqual([]);
    });

    test("a guest's 'Not now' keeps going when saving the email fails", async ({ page }) => {
      await setup(page, { saveEmail: "abort" });
      await toPaywall(page);
      await page.getByRole("button", { name: "Not now" }).filter({ visible: true }).first().click();
      await expect(page.getByTestId("hold-plan")).toBeVisible();
      await page.getByTestId("hold-plan-save").click();
      await expect(page.getByText("Enter an email like name@example.com")).toBeVisible();
      await page.getByLabel("Email").fill("learner@example.com");
      await page.getByTestId("hold-plan-save").click();
      await page.waitForURL((url) => url.pathname === "/", { timeout: 15_000 });
    });
  });
}

// ---------------------------------------------------------------------------
// The flow under pressure
// ---------------------------------------------------------------------------

for (const viewport of VIEWPORTS) {
  test.describe(`stress: flow (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });
    test.describe.configure({ timeout: 150_000 });

    test("double-clicking every button never skips a step", async ({ page }) => {
      const mocks = await setup(page);
      const seen: string[] = [];
      await page.goto("/onboarding/journey");
      await walk(page, {
        press: doubleClick,
        each: async (step) => {
          seen.push(step.name);
        },
      });
      await expect(paywallCta(page)).toBeVisible({ timeout: 15_000 });
      expect(seen).toEqual(STEPS.map((step) => step.name));
      expect(mocks.pageErrors).toEqual([]);
    });

    test("double-clicking vocab continue does not skip the advanced screen", async ({ page }) => {
      await setup(page);
      await page.goto("/onboarding/journey");
      await walk(page, { until: "vocab_basic" });
      await heading(page, "Which of these words do you recognize?");
      await page.getByTestId("vocab-none-known").click();
      await page.getByTestId("vocab-continue").dblclick();
      await page.waitForTimeout(500);
      await heading(page, "What about these more advanced words?");
    });

    test("reloading on every step resumes on the same step", async ({ page }) => {
      const mocks = await setup(page);
      await page.goto("/onboarding/journey");
      await walk(page, {
        each: async (step) => {
          await page.reload();
          await heading(page, step.heading, 20_000);
        },
      });
      await expect(paywallCta(page)).toBeVisible({ timeout: 15_000 });
      await page.reload();
      await expect(paywallCta(page)).toBeVisible({ timeout: 15_000 });
      expect(mocks.pageErrors).toEqual([]);
    });

    test("the browser Back button mid-flow, then returning, resumes the learner", async ({ page }) => {
      await setup(page);
      await page.goto("/");
      await page.goto("/onboarding/journey");
      await walk(page, { until: "experience" });
      await heading(page, "How long have you been learning Mandarin?");
      await page.goBack();
      const landed = new URL(page.url()).pathname;
      test.info().annotations.push({ type: "browser back went to", description: landed });
      await page.goForward();
      await heading(page, "How long have you been learning Mandarin?", 20_000);
    });
  });
}

test.describe("stress: saved data and network", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.describe.configure({ timeout: 150_000 });

  const hugeCustom = JSON.stringify({ answers: { goal: { primary: "work" }, interests: { keys: [], custom: "A".repeat(2_000_000) } } });
  const CORRUPT: Array<[string, string]> = [
    ["truncated JSON", '{"answers":{"goal":'],
    ["null", "null"],
    ["array", "[1,2,3]"],
    ["wrong types", '{"answers":"x","events":7,"revision":"9"}'],
    ["prototype pollution", '{"answers":{"__proto__":{"polluted":true},"goal":{"primary":"constructor"}},"events":{"__proto__":{"x":1}}}'],
    ["bogus calibration", '{"answers":{"level":{"selfReport":"few_words"},"calibration":{"items":[{"questionId":"nope","position":1}],"answers":[{"choiceId":"a"}],"placement":{"provisionalLevel":6}}}}'],
    ["two megabytes of custom text", hugeCustom],
  ];

  for (const [label, value] of CORRUPT) {
    test(`corrupt saved progress (${label}) starts cleanly`, async ({ page }) => {
      const mocks = await setup(page);
      await page.addInitScript(([key, raw]) => {
        if (!sessionStorage.getItem("seeded")) {
          sessionStorage.setItem("seeded", "1");
          localStorage.setItem(key, raw);
        }
      }, [LOCAL_KEY, value] as const);
      await page.goto("/onboarding/journey");
      await expect(page.getByTestId("onboarding-step")).toBeVisible({ timeout: 20_000 });
      const step = await page.getByTestId("onboarding-step").getAttribute("data-step");
      // The 2 MB case keeps a valid goal and a custom interest cut to 40 characters, so it resumes at the level.
      expect(["goal", "interests", "level"]).toContain(step);
      expect(await page.evaluate(() => (({}) as Record<string, unknown>).polluted)).toBeUndefined();
      const saved = await page.evaluate((key) => localStorage.getItem(key)?.length ?? 0, LOCAL_KEY);
      expect(saved, "saved progress stays small").toBeLessThan(20_000);
      expect(mocks.pageErrors).toEqual([]);
    });
  }

  test("a forged 'committed' state or ?resume=paywall can't skip the questions", async ({ page }) => {
    await setup(page);
    await page.addInitScript((key) => {
      if (!sessionStorage.getItem("seeded")) {
        sessionStorage.setItem("seeded", "1");
        localStorage.setItem(
          key,
          JSON.stringify({ answers: { commitment: { committedAt: "2026-01-01T00:00:00.000Z" } }, events: { plan: { completed_at: "2026-01-01T00:00:00.000Z" } } }),
        );
      }
    }, LOCAL_KEY);
    await page.goto("/onboarding/journey?resume=paywall");
    await expect(page.getByTestId("onboarding-step")).toHaveAttribute("data-step", "goal", { timeout: 20_000 });
  });

  test("a slow insight service doesn't hold up the plan", async ({ page }) => {
    await setup(page, { insightDelayMs: 15_000 });
    await page.goto("/onboarding/journey");
    await walk(page, { until: "reflect" });
    const started = Date.now();
    await heading(page, /^From .+ in \d+ weeks$/, 12_000);
    test.info().annotations.push({ type: "building to reflection", description: `${Date.now() - started} ms` });
  });

  test("going offline mid-flow: a guest still reaches the paywall and checkout fails gracefully", async ({ page }) => {
    const mocks = await setup(page);
    await page.goto("/onboarding/journey");
    await walk(page, { until: "interests" });
    await page.context().setOffline(true);
    await walk(page, { from: "interests" });
    await expect(paywallCta(page)).toBeVisible({ timeout: 15_000 });
    await paywallCta(page).click();
    await expect(
      page.getByRole("heading", { name: "Create an account" }).or(page.getByText(/Could not start checkout/).filter({ visible: true }).first()),
    ).toBeVisible({ timeout: 15_000 });
    await page.context().setOffline(false);
    expect(mocks.checkoutBodies).toEqual([]);
  });

  test("slow, flaky saves for a signed-in learner: flow completes, saves stay bounded, Stripe is reached", async ({ page }) => {
    const mocks = await setup(page, { signedIn: true, saveDelayMs: 1_200, failSave: (n) => n % 2 === 1 });
    await toPaywall(page);
    await paywallCta(page).click();
    await page.waitForURL(STRIPE_URL, { timeout: 30_000 });
    const committed = mocks.savedStates.some((state) => Boolean((state as { answers?: { commitment?: { committedAt?: string } } }).answers?.commitment?.committedAt));
    test.info().annotations.push({ type: "saves", description: `${mocks.puts} PUTs, committed state saved: ${committed}` });
    expect(mocks.puts).toBeLessThan(60);
    expect(committed, "the committed plan reached the server before Stripe").toBe(true);
  });

  test("a server that always reports a conflict doesn't cause a save storm", async ({ page }) => {
    const mocks = await setup(page, { signedIn: true, alwaysConflict: true });
    await toPaywall(page);
    const atPaywall = mocks.puts;
    await page.waitForTimeout(8_000);
    test.info().annotations.push({ type: "saves", description: `${atPaywall} PUTs during the flow, ${mocks.puts - atPaywall} while idle on the paywall` });
    expect(mocks.puts - atPaywall, "saves while idle").toBeLessThanOrEqual(3);
    expect(mocks.puts).toBeLessThan(120);
  });

  test("two tabs signed in to the same account settle without ping-ponging saves", async ({ page }) => {
    const mocks = await setup(page, { signedIn: true });
    await page.goto("/onboarding/journey");
    await walk(page, { until: "level" });
    await heading(page, "How does your Mandarin feel right now?");
    await page.waitForTimeout(1_500);

    const second = await page.context().newPage();
    await second.goto("/onboarding/journey");
    await heading(second, "How does your Mandarin feel right now?", 20_000);

    await page.getByTestId("level-few_words").click();
    await page.getByTestId("continue").click();
    await second.getByTestId("level-new").click();
    await second.getByTestId("continue").click();
    await page.waitForTimeout(3_000);
    const settled = mocks.puts;
    await page.waitForTimeout(6_000);
    test.info().annotations.push({ type: "saves", description: `${settled} PUTs, ${mocks.puts - settled} more while idle` });
    expect(mocks.puts - settled, "saves while both tabs sit idle").toBe(0);
    expect(mocks.pageErrors).toEqual([]);
  });

  test("hostile text in free-text fields is shown as text, never run", async ({ page }) => {
    const mocks = await setup(page);
    const dialogs: string[] = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });
    const payload = `<img src=x onerror="window.__xss=1">🙂‏שלום${"x".repeat(200)}`;
    await page.goto("/onboarding/journey");
    await heading(page, "Why do you want to learn Mandarin?");
    await page.getByTestId("goal-work").click();
    await page.getByTestId("continue").click();
    await heading(page, "Which situations do you want to handle first?");
    await page.getByRole("button", { name: "Add your own" }).click();
    await page.getByLabel("Your own topic").fill(payload);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByTestId("continue").click();
    await heading(page, "How does your Mandarin feel right now?");
    await page.getByTestId("level-few_words").click();
    await page.getByTestId("continue").click();
    await heading(page, "How long have you been learning Mandarin?");
    await page.getByTestId("experience-on_and_off").click();
    await page.getByTestId("continue").click();
    await heading(page, /what usually happens/);
    await page.getByTestId("pain-something_else").click();
    await page.getByTestId("custom-pain-text").fill(payload);
    await page.getByTestId("timing-ongoing").click();
    await page.getByTestId("continue").click();
    for (const step of STEPS.slice(STEPS.findIndex((candidate) => candidate.name === "learning_pain"))) {
      await heading(page, step.heading, 20_000);
      if (step.name === "commitment") {
        await page.getByLabel("Your first name").fill(`<script>window.__xss=1</script>${"y".repeat(100)}`);
        const typed = await page.getByLabel("Your first name").inputValue();
        expect(typed.length).toBeLessThanOrEqual(40);
        await page.getByTestId("commitment-cta").click();
        continue;
      }
      await step.act(page, click);
    }
    await expect(paywallCta(page)).toBeVisible({ timeout: 15_000 });
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    expect(dialogs).toEqual([]);
    expect(mocks.pageErrors).toEqual([]);
  });
});

for (const viewport of [
  { name: "small phone", width: 320, height: 568 },
  { name: "phone landscape", width: 844, height: 390 },
] as const) {
  test.describe(`stress: ${viewport.name}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });
    test.describe.configure({ timeout: 150_000 });

    test("every step fits the width and the paywall button is usable", async ({ page }) => {
      const mocks = await setup(page, { signedIn: true });
      const overflow: string[] = [];
      await page.goto("/onboarding/journey");
      await walk(page, {
        each: async (step) => {
          const extra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          if (extra > 1) overflow.push(`${step.name} (+${extra}px)`);
        },
      });
      await expect(paywallCta(page)).toBeVisible({ timeout: 15_000 });
      const extra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (extra > 1) overflow.push(`paywall (+${extra}px)`);
      expect(overflow, "steps wider than the screen").toEqual([]);
      await paywallCta(page).click();
      await page.waitForURL(STRIPE_URL, { timeout: 15_000 });
      expect(mocks.checkoutBodies).toHaveLength(1);
    });
  });
}

// ---------------------------------------------------------------------------
// Local server under load (no sign-in, nothing reaches Stripe or the database)
// ---------------------------------------------------------------------------

test.describe("stress: API under load", () => {
  test.describe.configure({ timeout: 180_000 });

  function percentile(values: number[], p: number) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
  }

  test("100 concurrent progress checks and 30 concurrent page loads all succeed", async ({ request }) => {
    const timed = async (run: () => Promise<{ status(): number }>) => {
      const started = Date.now();
      const response = await run();
      return { status: response.status(), ms: Date.now() - started };
    };
    const progress = await Promise.all(Array.from({ length: 100 }, () => timed(() => request.get("/api/onboarding/progress?tz=UTC"))));
    const pages = await Promise.all(Array.from({ length: 30 }, () => timed(() => request.get("/onboarding/journey"))));
    const describe = (rows: Array<{ ms: number }>) => `p50 ${percentile(rows.map((row) => row.ms), 50)} ms, p95 ${percentile(rows.map((row) => row.ms), 95)} ms`;
    test.info().annotations.push({ type: "progress API", description: describe(progress) });
    test.info().annotations.push({ type: "onboarding page", description: describe(pages) });
    expect(progress.filter((row) => row.status !== 200)).toEqual([]);
    expect(pages.filter((row) => row.status !== 200)).toEqual([]);
  });

  test("malformed and oversized requests are refused without server errors", async ({ request }) => {
    const big = "x".repeat(2 * 1024 * 1024);
    const sameOrigin = { origin: "http://localhost:3002", "content-type": "application/json" };
    const cases: Array<[string, () => Promise<{ status(): number }>, number[]]> = [
      ["checkout: broken JSON", () => request.post("/api/stripe/checkout", { headers: sameOrigin, data: "{" }), [401]],
      ["checkout: 2 MB body", () => request.post("/api/stripe/checkout", { headers: sameOrigin, data: big }), [401, 413]],
      ["checkout: array body", () => request.post("/api/stripe/checkout", { headers: sameOrigin, data: "[]" }), [401]],
      ["checkout: GET", () => request.get("/api/stripe/checkout"), [405]],
      ["activate: guest", () => request.post("/api/onboarding/activate", { headers: sameOrigin, data: { stage: "complete" } }), [401]],
      ["activate: cross-site", () => request.post("/api/onboarding/activate", { headers: { ...sameOrigin, origin: "https://evil.example" }, data: {} }), [403]],
      ["progress save: cross-site", () => request.put("/api/onboarding/progress", { headers: { ...sameOrigin, origin: "https://evil.example" }, data: {} }), [403]],
      ["progress save: guest", () => request.put("/api/onboarding/progress", { headers: sameOrigin, data: { state: big } }), [401, 413]],
      ["progress reset: guest", () => request.delete("/api/onboarding/progress", { headers: sameOrigin }), [401]],
      ["insight: cross-site", () => request.post("/api/onboarding/insight", { headers: { ...sameOrigin, origin: "https://evil.example" }, data: {} }), [403]],
      ["insight: incomplete answers", () => request.post("/api/onboarding/insight", { headers: sameOrigin, data: { answers: { goal: big } } }), [400]],
      ["pronunciation: cross-site", () => request.post("/api/onboarding/pronunciation", { headers: { origin: "https://evil.example" }, multipart: { targetText: "你好" } }), [403]],
      ["pronunciation: guest", () => request.post("/api/onboarding/pronunciation", { headers: { origin: "http://localhost:3002" }, multipart: { targetText: "你好" } }), [401]],
      ["abandon: guest junk", () => request.post("/api/onboarding/abandon", { headers: sameOrigin, data: big }), [401, 403, 413]],
    ];
    const results: string[] = [];
    for (const [label, run, expected] of cases) {
      const status = (await run()).status();
      results.push(`${label}: ${status}`);
      expect(expected, `${label} answered ${status}`).toContain(status);
    }
    test.info().annotations.push({ type: "statuses", description: results.join("; ") });
  });
});
