import { readFileSync } from "node:fs";
import { expect, test, type Page, type Route } from "@playwright/test";
import { scoreAssessment, selectAssessment } from "../../lib/onboarding/personalized/assessment";
import type { OnboardingVariant } from "../../lib/onboarding/personalized/experiment";
import { initialState, LOCAL_STORAGE_KEY, markCompleted } from "../../lib/onboarding/personalized/flow";
import { getQuestion } from "../../lib/onboarding/personalized/questionBank";
import { mockMiniLessonFlag } from "./helpers/onboardingExperiment";

/**
 * Quick payment smoke for both mini-lesson-onboarding variants.
 * Seeds near the end so we only verify commitment → paywall → Stripe hand-off.
 */

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  readFileSync(".env.local", "utf8").match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)?.[1]?.trim() ??
  "";
const PROJECT_REF = new URL(SUPABASE_URL).hostname.split(".")[0];
const STRIPE_URL = "https://checkout.stripe.com/c/pay/cs_test_variant_mock";
const USER = {
  id: "00000000-0000-4000-8000-0000000000v2",
  aud: "authenticated",
  role: "authenticated",
  email: "variant-checkout@example.com",
  is_anonymous: false,
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function setup(page: Page, variant: OnboardingVariant) {
  const checkoutBodies: Array<Record<string, unknown>> = [];
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
  await page.route(/posthog\.com/, (route) => route.abort());
  await mockMiniLessonFlag(page, variant);
  await page.route(`${SUPABASE_URL}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/auth/v1/user") return json(route, USER);
    return json(route, { message: "Not mocked" }, 401);
  });
  let stored: Record<string, unknown> | null = null;
  let revision = 0;
  await page.route("**/api/onboarding/progress**", async (route) => {
    if (route.request().method() === "GET") {
      return json(route, { account: { kind: "user", firstName: "Cameron" }, progress: stored });
    }
    const body = route.request().postDataJSON() as { state: Record<string, unknown> };
    revision += 1;
    stored = { ...body.state, revision, updatedAt: new Date().toISOString(), activatedAt: null };
    return json(route, { status: "saved", progress: stored });
  });
  await page.route("**/api/onboarding/abandon", (route) => json(route, { status: "ok" }));
  await page.route("**/api/onboarding/first-lesson", (route) => json(route, { lesson: null }));
  await page.route("**/api/entitlements**", (route) => json(route, { plan: "free", isIslandsPro: false, isHskPro: false }));
  await page.route("**/api/stripe/reconcile", (route) => json(route, { status: "ok" }));
  await page.route("**/api/stripe/checkout", (route) => {
    checkoutBodies.push(route.request().postDataJSON() as Record<string, unknown>);
    return json(route, { url: STRIPE_URL });
  });
  await page.route("https://checkout.stripe.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Mock Stripe Checkout</h1>" }),
  );
  return { checkoutBodies };
}

function seedNearCommitment(variant: OnboardingVariant) {
  const now = new Date("2026-11-12T12:00:00.000Z");
  let state = initialState(now, variant);
  const a = state.answers;
  a.goal = { primary: "work", secondary: null, otherText: null };
  a.interests = { keys: ["meetings"], custom: null };
  a.level = { selfReport: "few_words" };
  a.experience = { key: "on_and_off" };
  a.usingPain = { keys: ["stay_quiet"], timing: "ongoing", upcomingText: null };
  a.learningPain = { keys: ["not_relevant"], hesitations: [] };
  a.availability = { minutes: "10", days: "5", session: null };
  a.pronunciation = { status: "skipped", toneSupport: null };
  if (variant === "test") {
    a.vocabBasic = {
      shownIds: ["wo", "ni", "hao", "shi", "bu", "you", "he", "shui", "cha", "kafei", "fan", "mai", "qian", "che", "feiji"],
      selectedIds: [],
      noneKnown: true,
    };
    a.vocabAdvanced = {
      shownIds: ["taolun", "hezuo", "chenggong", "jingyan", "jihui", "fuwu", "yuding", "jiaotong", "wenhua", "guanxi", "xingqu", "jishu", "shuju", "touzi"],
      selectedIds: [],
      noneKnown: true,
    };
    a.estimatedLevel = 1;
    a.firstLesson = {
      ...a.firstLesson,
      lessonId: "work-beginner-basic-requests",
      phase: "complete",
      completedAt: now.toISOString(),
      xpAwarded: ["meaning", "build", "speaking", "exchange"],
    };
  } else {
    // parseAnswers recomputes placement from items+answers; a bare placement object is dropped.
    const attemptId = "6f1c2b9e-4a7d-4c1e-9b2a-0d3e5f7a9b1c";
    const claimedLevel = 1 as const;
    const items = selectAssessment({ claimedLevel, topic: "work", seed: attemptId });
    const answers = items.map((item) => {
      const question = getQuestion(item.questionId)!;
      return { position: item.position, questionId: item.questionId, choiceId: question.answer };
    });
    a.calibration = {
      attemptId,
      claimedLevel,
      items,
      answers,
      placement: scoreAssessment({ claimedLevel, items, answers }),
      writingSystem: "simplified",
    };
  }
  const completed =
    variant === "test"
      ? (["goal", "interests", "level", "vocab_basic", "vocab_advanced", "experience", "using_pain", "learning_pain", "reviews", "availability", "building", "reflect", "first_lesson"] as const)
      : (["goal", "interests", "level", "experience", "using_pain", "learning_pain", "reviews", "calibration", "pronunciation", "availability", "building", "reflect"] as const);
  for (const step of completed) state = markCompleted(state, step, now);
  return state;
}

function paywallCta(page: Page) {
  return page
    .getByRole("button", { name: /^(Start learning Mandarin|Start my plan|Activate my plan|Start my Mandarin plan)/ })
    .filter({ visible: true })
    .first();
}

for (const width of [390, 1440]) for (const checkoutVariant of ["control", "test"] as const) {
 const variant = "test";
  test(`checkout-modal ${checkoutVariant} at ${width}px: billing choice reaches Stripe`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({width, height:844});
    const mocks = await setup(page, variant);
    await page.route("**/flags/**", route => route.fulfill({json:{featureFlags:{"mini-lesson-onboarding":"test","checkout-modal":checkoutVariant},featureFlagPayloads:{}}}));
    const state = seedNearCommitment(variant);
    await page.addInitScript(
      ({ key, state }) => localStorage.setItem(key, JSON.stringify(state)),
      { key: LOCAL_STORAGE_KEY, state },
    );
    await page.goto("/onboarding/journey?resume=commitment");
    const commitmentTitle =
      variant === "test" ? "Ready to continue your Mandarin journey?" : "Ready to begin your Mandarin journey?";
    await expect(page.getByRole("heading", { level: 1, name: commitmentTitle })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("onboarding-step")).toHaveAttribute("data-onboarding-variant", variant);
    await page.getByLabel("Your first name").fill("Cameron");
    await page.getByTestId("commitment-cta").click();
    await expect(paywallCta(page)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("conversation-paywall")).toBeVisible();
    await expect(page.getByTestId("conversation-paywall")).toHaveAttribute("data-checkout-modal-variant",width < 768 ? checkoutVariant : "control");
    await expect(page.getByTestId("conversation-comparison")).toBeVisible();
    await page.getByTestId("plan-yearly").click();
    await expect(page.getByTestId("plan-yearly")).toHaveAttribute("aria-pressed","true");
    await expect(page.getByTestId("conversation-paywall")).toContainText("$79.99 billed yearly");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await paywallCta(page).click();
    await page.waitForURL(STRIPE_URL, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Mock Stripe Checkout" })).toBeVisible();
    expect(mocks.checkoutBodies).toHaveLength(1);
    expect(mocks.checkoutBodies[0]).toMatchObject({
      interval: "yearly",
      cancelContext: "onboarding",
      cancelPath: "/onboarding/journey?canceled=1&plan=yearly",
    });
  });
}
