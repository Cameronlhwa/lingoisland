import { readFileSync } from "node:fs";
import { expect, test, type Page, type Route } from "@playwright/test";

// Checkout is tested up to the Stripe hand-off. Stripe, Supabase auth, our APIs
// and analytics are all mocked, so no charge, account or database row is created.
// The only real call is the guest check against /api/stripe/checkout, which is
// refused before Stripe is contacted.

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  readFileSync(".env.local", "utf8").match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim() ??
  "";
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const STRIPE_URL = "https://checkout.stripe.com/c/pay/cs_test_e2e_mock";

const USER = {
  id: "00000000-0000-4000-8000-0000000000e2",
  aud: "authenticated",
  role: "authenticated",
  email: "checkout-e2e@example.com",
  is_anonymous: false,
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};

type Options = {
  signedIn?: boolean;
  pro?: boolean;
  checkout?: { status: number; body: Record<string, unknown> };
};

type Mocks = {
  checkoutBodies: Array<Record<string, unknown>>;
  savedStates: Array<Record<string, unknown>>;
  supabaseCalls: string[];
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function setup(page: Page, options: Options = {}): Promise<Mocks> {
  const mocks: Mocks = { checkoutBodies: [], savedStates: [], supabaseCalls: [] };
  let stored: Record<string, unknown> | null = null;
  let revision = 0;

  if (options.signedIn) {
    const now = Math.floor(Date.now() / 1000);
    const session = {
      access_token: "e2e-access-token",
      refresh_token: "e2e-refresh-token",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: now + 3600,
      user: USER,
    };
    await page.context().addCookies([
      {
        name: `sb-${PROJECT_REF}-auth-token`,
        value: encodeURIComponent(JSON.stringify(session)),
        url: "http://localhost:3002",
      },
    ]);
  }

  await page.route(/posthog\.com/, (route) => route.abort());
  await page.route(`${SUPABASE_URL}/**`, (route) => {
    const url = new URL(route.request().url());
    mocks.supabaseCalls.push(url.pathname);
    if (url.pathname === "/auth/v1/user" && options.signedIn) return json(route, USER);
    return json(route, { message: "Not mocked" }, 401);
  });
  await page.route("**/api/onboarding/progress**", async (route) => {
    if (route.request().method() === "GET") {
      return json(route, {
        account: { kind: options.signedIn ? "user" : "guest", firstName: options.signedIn ? "Cameron" : null },
        progress: stored,
      });
    }
    const body = route.request().postDataJSON() as { state: Record<string, unknown> };
    mocks.savedStates.push(body.state);
    revision += 1;
    stored = { ...body.state, revision, updatedAt: new Date().toISOString(), activatedAt: null };
    return json(route, { status: "saved", progress: stored });
  });
  await page.route("**/api/onboarding/abandon", (route) => json(route, { status: "ok" }));
  await page.route("**/api/profile**", (route) => json(route, { error: "Unauthorized" }, 401));
  await page.route("**/api/entitlements**", (route) =>
    json(route, { plan: options.pro ? "pro" : "free", isIslandsPro: Boolean(options.pro), isHskPro: false }),
  );
  await page.route("**/api/stripe/reconcile", (route) => json(route, { status: "ok" }));
  await page.route("**/api/stripe/checkout", (route) => {
    mocks.checkoutBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    const reply = options.checkout ?? { status: 200, body: { url: STRIPE_URL } };
    return json(route, reply.body, reply.status);
  });
  await page.route("https://checkout.stripe.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Mock Stripe Checkout</h1>" }),
  );
  return mocks;
}

async function heading(page: Page, name: string | RegExp) {
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({ timeout: 15_000 });
}

async function toCommitment(page: Page) {
  await page.goto("/onboarding/journey");
  await heading(page, "Why do you want to learn Mandarin?");
  await page.getByTestId("goal-work").click();
  await page.getByTestId("continue").click();
  await heading(page, "What would you like to talk about in Mandarin?");
  await page.getByTestId("interest-meetings").click();
  await page.getByTestId("continue").click();
  await heading(page, "How does your Mandarin feel right now?");
  await page.getByTestId("level-few_words").click();
  await page.getByTestId("continue").click();
  await page.getByTestId("social-proof-continue").click();
  await page.getByTestId("calibration-start").click();
  for (let index = 1; index <= 5; index += 1) {
    await expect(page.getByTestId("onboarding-step").getByText(`Question ${index} of 5`)).toBeVisible();
    await page.getByTestId("calibration-choice").first().click();
  }
  await page.getByTestId("pronunciation-skip").click();
  await heading(page, "How much time can you usually spend learning Mandarin?");
  await page.getByTestId("minutes-10").click();
  await page.getByTestId("days-5").click();
  await page.getByTestId("continue").click();
  await heading(page, "Here’s your personalized plan");
  await page.getByTestId("continue").click();
  await heading(page, "Ready to begin your Mandarin journey?");
  await page.getByLabel("Your first name").fill("Cameron");
}

async function toPaywall(page: Page) {
  await toCommitment(page);
  await page.getByTestId("commitment-cta").click();
  await expect(paywallCta(page)).toBeVisible({ timeout: 15_000 });
}

function paywallCta(page: Page) {
  return page.getByRole("button", { name: /^(Activate my plan|Start my Mandarin plan)/ }).filter({ visible: true }).first();
}

function annualButton(page: Page) {
  return page.getByRole("button", { name: /^Annual/ }).filter({ visible: true }).first();
}

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const) {
  test.describe(`onboarding checkout (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });
    test.describe.configure({ timeout: 120_000 });

    test("a signed-in learner reaches Stripe Checkout with the chosen plan, and canceling returns to the paywall", async ({ page }) => {
      const mocks = await setup(page, { signedIn: true });
      await toPaywall(page);
      await annualButton(page).click();
      await expect(annualButton(page)).toHaveAttribute("aria-pressed", "true");
      await paywallCta(page).click();

      await page.waitForURL(STRIPE_URL, { timeout: 15_000 });
      await expect(page.getByRole("heading", { name: "Mock Stripe Checkout" })).toBeVisible();
      expect(mocks.checkoutBodies).toHaveLength(1);
      expect(mocks.checkoutBodies[0]).toEqual({
        interval: "yearly",
        cancelContext: "onboarding",
        cancelPath: "/onboarding/journey?canceled=1&plan=yearly",
      });
      const committed = mocks.savedStates[mocks.savedStates.length - 1] as {
        answers: { commitment: { committedAt: string | null } };
      };
      expect(committed.answers.commitment.committedAt).toBeTruthy();
      expect(mocks.supabaseCalls.every((path) => path === "/auth/v1/user")).toBe(true);

      await page.goto(String(mocks.checkoutBodies[0].cancelPath));
      await expect(paywallCta(page)).toBeVisible({ timeout: 15_000 });
      await expect(annualButton(page)).toHaveAttribute("aria-pressed", "true");
      expect(await page.evaluate(() => localStorage.getItem("lingo_onboarding_activate_v1"))).toBe("1");
      expect(mocks.checkoutBodies).toHaveLength(1);
    });

    test("an account that already has Pro skips checkout and goes to plan activation", async ({ page }) => {
      const mocks = await setup(page, { signedIn: true, pro: true });
      const appRequests: string[] = [];
      await page.route(
        (url) => url.pathname === "/app/onboarding",
        (route) => {
          appRequests.push(route.request().url());
          return route.fulfill({ status: 200, contentType: "text/html", body: "<h1>App</h1>" });
        },
      );
      await toCommitment(page);
      await page.getByTestId("commitment-cta").click();
      await expect.poll(() => appRequests.some((url) => url.includes("/app/onboarding?activate=1")), { timeout: 15_000 }).toBe(true);
      expect(mocks.checkoutBodies).toEqual([]);
    });

    test("a checkout error keeps the learner on the paywall with a message", async ({ page }) => {
      const mocks = await setup(page, {
        signedIn: true,
        checkout: { status: 500, body: { error: "Could not start checkout" } },
      });
      await toPaywall(page);
      await paywallCta(page).click();
      await expect(page.getByText("Could not start checkout").filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });
      expect(page.url()).toContain("/onboarding/journey");
      await expect(paywallCta(page)).toBeEnabled();
      expect(mocks.checkoutBodies).toHaveLength(1);
    });

    test("a guest is asked to create an account first, and the real checkout API refuses guests", async ({ page }) => {
      const mocks = await setup(page);
      await toPaywall(page);
      await paywallCta(page).click();
      await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("You'll go to secure checkout right after.", { exact: false })).toBeVisible();
      expect(mocks.checkoutBodies).toEqual([]);

      const response = await page.request.post("/api/stripe/checkout", { data: { interval: "monthly", cancelContext: "onboarding" } });
      expect(response.status()).toBe(401);
    });
  });
}
