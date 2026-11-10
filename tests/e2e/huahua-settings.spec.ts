import { expect, test, type Page, type Route } from "@playwright/test";

// Browser tests for the Huahua UI on a dev-only harness page. Every SMS API
// is mocked with page.route: nothing is sent and no secrets are needed.

type Json = Record<string, unknown>;

const BASE_PHONE = {
  available: true,
  supportedCountries: [
    { code: "CA", dialCode: "+1" },
    { code: "US", dialCode: "+1" },
  ],
  consentVersion: "2026-11-04",
  lingoNumber: "+1 (416) 555-0100",
  pending: null,
};

const ACTIVE_CONTACT = {
  status: "active",
  maskedNumber: "+1 ••• ••• 4567",
  countryCode: "CA",
  verifiedAt: "2026-11-01T00:00:00Z",
  consentAt: "2026-11-01T00:00:00Z",
  welcomeSentAt: "2026-11-01T00:00:00Z",
  pausedAt: null,
  pausedReason: null,
  optedOutAt: null,
  disabledAt: null,
  hasDeliveryIssue: false,
};

const ALL_PERSONAS = ["friendly_friend", "focused_coach", "accountability_partner", "professional_partner"];

function phoneState(contact: Json | null = ACTIVE_CONTACT, pending: Json | null = null) {
  return { ...BASE_PHONE, contact, pending };
}

function overview(overrides: { subscribed?: boolean; used?: number; contact?: Json | null; prefs?: Json } = {}) {
  const subscribed = overrides.subscribed ?? true;
  const allowance = subscribed ? 600 : 8;
  const used = overrides.used ?? 42;
  const ratio = Math.min(used / allowance, 1);
  return {
    phone: phoneState(overrides.contact === undefined ? ACTIVE_CONTACT : overrides.contact),
    plan: {
      key: subscribed ? "subscriber" : "free",
      subscribed,
      personas: subscribed ? ALL_PERSONAS : ["friendly_friend"],
      proactiveOpeners: subscribed,
    },
    preferences: {
      persona: "friendly_friend",
      correctionMode: "gentle",
      scaffolding: "auto",
      daysPerWeek: 3,
      preferredDays: [],
      openersPerWeek: 3,
      openersPerWeekIsCustom: false,
      autoAdjust: true,
      deliveryWindows: [{ start: 1080, end: 1260 }],
      timezone: "America/Toronto",
      ...overrides.prefs,
    },
    usage: {
      used: Math.min(used, allowance),
      allowance,
      ratio,
      state: used >= allowance ? "exhausted" : ratio >= 0.8 ? "warning" : "ok",
      resetsAt: subscribed ? "2026-12-01T05:00:00Z" : null,
      showUpgrade: false,
    },
    threads: [
      {
        id: "t1",
        origin: "opener",
        started_at: "2026-11-05T23:00:00Z",
        status: "closed",
        messages: [
          { direction: "outbound", body: "你今天喝咖啡了吗？\n(Did you have coffee today?)", at: "2026-11-05T23:00:00Z" },
          { direction: "inbound", body: "喝了！我喝了拿铁。", at: "2026-11-05T23:05:00Z" },
        ],
      },
    ],
    words: {
      needsPractice: [{ word: "拿铁", pinyin: "nátiě", english: "latte", comfort_score: 0.3, last_practiced_at: null }],
      gettingComfortable: [{ word: "咖啡", pinyin: "kāfēi", english: "coffee", comfort_score: 0.8, last_practiced_at: null }],
      recent: [],
    },
    countries: { enabled: ["CA", "US"], interest: [{ code: "GB", name: "United Kingdom" }] },
  };
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

type Mock = { overview: ReturnType<typeof overview>; patches: Json[]; phoneActions: string[] };

async function mockApis(page: Page, initial: ReturnType<typeof overview>, options: { delayMs?: number } = {}): Promise<Mock> {
  const mock: Mock = { overview: initial, patches: [], phoneActions: [] };
  await page.route("**/api/sms/huahua", async (route) => {
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    const request = route.request();
    if (request.method() === "PATCH") {
      const patch = request.postDataJSON() as Json;
      mock.patches.push(patch);
      const prefs = { ...mock.overview.preferences, ...patch };
      if ("daysPerWeek" in patch) {
        const days = Number(patch.daysPerWeek);
        prefs.openersPerWeek = days <= 2 ? 2 : days <= 5 ? 3 : 5;
      }
      mock.overview = { ...mock.overview, preferences: prefs };
    }
    await json(route, mock.overview);
  });
  await page.route("**/api/sms/huahua/history", async (route) => {
    mock.overview = { ...mock.overview, threads: [] };
    await json(route, mock.overview);
  });
  await page.route("**/api/sms/phone", async (route) => {
    const request = route.request();
    if (request.method() === "PATCH") {
      const action = (request.postDataJSON() as { action: string }).action;
      mock.phoneActions.push(action);
      const contact =
        action === "pause"
          ? { ...ACTIVE_CONTACT, status: "paused", pausedAt: new Date().toISOString(), pausedReason: "user" }
          : ACTIVE_CONTACT;
      mock.overview = { ...mock.overview, phone: phoneState(contact) };
    }
    await json(route, mock.overview.phone);
  });
  return mock;
}

test.describe("Huahua settings page", () => {
  test("shows loading, then status, style, schedule, usage, words, and conversations", async ({ page }) => {
    await mockApis(page, overview(), { delayMs: 400 });
    await page.goto("/dev/huahua");
    await expect(page.getByLabel("Loading texting settings")).toBeVisible();

    await expect(page.getByText("+1 ••• ••• 4567")).toBeVisible();
    await expect(page.getByText("Active", { exact: true })).toBeVisible();
    await expect(page.getByRole("radio", { name: /Friendly friend/ })).toBeChecked();
    await expect(page.getByRole("radio", { name: /Gentle/ })).toBeChecked();
    await expect(page.getByTestId("huahua-usage")).toContainText("42 of 600 practice texts this month");
    await expect(page.getByText("Needs more practice")).toBeVisible();
    await expect(page.getByText("拿铁", { exact: true })).toBeVisible();
    await expect(page.getByText("Getting comfortable")).toBeVisible();

    await page.getByRole("button", { name: /华华 started/ }).click();
    await expect(page.locator("ol").getByText("喝了！我喝了拿铁。")).toBeVisible();

    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/telnyx|segment|webhook/i);
    expect(text).not.toMatch(/upgrade/i);
  });

  test("selects a persona and correction mode", async ({ page }) => {
    const mock = await mockApis(page, overview());
    await page.goto("/dev/huahua");
    await page.getByRole("radio", { name: /Professional practice partner/ }).check();
    await expect(page.getByRole("radio", { name: /Professional practice partner/ })).toBeChecked();
    await page.getByRole("radio", { name: /Hint first/ }).check();
    await expect(page.getByRole("radio", { name: /Hint first/ })).toBeChecked();
    expect(mock.patches).toEqual([{ persona: "professional_partner" }, { correctionMode: "hint_first" }]);
  });

  test("edits the schedule", async ({ page }) => {
    const mock = await mockApis(page, overview());
    await page.goto("/dev/huahua");
    await page.getByLabel("How many days a week do you want to practice?").selectOption("6");
    await expect(page.getByTestId("huahua-frequency")).toContainText("about 5 conversations a week");
    await page.getByRole("button", { name: "Sat", exact: true }).click();
    await expect(page.getByRole("button", { name: "Sat", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByLabel("From").selectOption(String(17 * 60));
    expect(mock.patches).toContainEqual({ daysPerWeek: 6, openersPerWeek: null });
    expect(mock.patches).toContainEqual({ preferredDays: [6] });
    expect(mock.patches).toContainEqual({ deliveryWindows: [{ start: 1020, end: 1260 }] });
  });

  test("pauses and resumes proactive texts", async ({ page }) => {
    const mock = await mockApis(page, overview());
    await page.goto("/dev/huahua");
    await page.getByRole("button", { name: "Pause texts" }).click();
    await expect(page.getByText("Paused", { exact: true })).toBeVisible();
    await expect(page.getByText(/won.t text you first, but you can still text/)).toBeVisible();
    await page.getByRole("button", { name: "Resume texts" }).click();
    await expect(page.getByText("Active", { exact: true })).toBeVisible();
    expect(mock.phoneActions).toEqual(["pause", "resume"]);
  });

  test("explains an automatic pause without guilt", async ({ page }) => {
    await mockApis(
      page,
      overview({ contact: { ...ACTIVE_CONTACT, status: "paused", pausedAt: "2026-11-05T00:00:00Z", pausedReason: "no_response" } }),
    );
    await page.goto("/dev/huahua");
    await expect(page.getByText(/We paused practice texts while you.re busy/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Resume texts" })).toBeVisible();
  });

  test("shows a clear state when the allowance is used, with no upsell for free learners", async ({ page }) => {
    await mockApis(page, overview({ subscribed: false, used: 8 }));
    await page.goto("/dev/huahua");
    await expect(page.getByTestId("huahua-usage")).toContainText("8 of 8 free practice texts");
    await expect(page.getByText(/used your free practice texts/)).toBeVisible();
    await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
    await expect(page.getByText(/upgrade|plans with more/i)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Schedule" })).toHaveCount(0);
    await expect(page.getByRole("radio", { name: /Focused coach/ })).toHaveCount(0);
  });

  test("deletes history after confirmation", async ({ page }) => {
    await mockApis(page, overview());
    await page.goto("/dev/huahua");
    await page.getByRole("button", { name: "Delete texting history" }).click();
    await page.getByRole("button", { name: "Delete history" }).click();
    await expect(page.getByText("No conversations yet.")).toBeVisible();
  });

  test("shows an error with retry when loading fails", async ({ page }) => {
    let fail = true;
    await page.route("**/api/sms/huahua", async (route) => {
      if (fail) return json(route, { error: "Something went wrong. Please try again.", code: "server_error" }, 500);
      return json(route, overview());
    });
    await page.route("**/api/sms/phone", (route) => json(route, phoneState()));
    await page.goto("/dev/huahua");
    await expect(page.getByText("Couldn't load your texting settings.")).toBeVisible();
    fail = false;
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("+1 ••• ••• 4567")).toBeVisible();
  });

  test("shows a calm message when texting isn't available", async ({ page }) => {
    await page.route("**/api/sms/huahua", (route) =>
      json(route, { unavailable: true, phone: { ...phoneState(null), available: false } }),
    );
    await page.route("**/api/sms/phone", (route) => json(route, { ...phoneState(null), available: false }));
    await page.goto("/dev/huahua");
    await expect(page.getByText(/isn't available right now/).first()).toBeVisible();
  });

  test("fits a phone screen without horizontal scrolling", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockApis(page, overview());
    await page.goto("/dev/huahua");
    await expect(page.getByText("+1 ••• ••• 4567")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "test-results/huahua-settings-mobile.png", fullPage: true });
  });

  test("desktop screenshot", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockApis(page, overview());
    await page.goto("/dev/huahua");
    await expect(page.getByText("+1 ••• ••• 4567")).toBeVisible();
    await page.screenshot({ path: "test-results/huahua-settings-desktop.png", fullPage: true });
  });
});

test.describe("onboarding phone setup", () => {
  test("verifies a number, then offers style choices", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let verified = false;
    const pending = {
      maskedNumber: "+1 ••• ••• 4567",
      expiresAt: new Date(Date.now() + 600_000).toISOString(),
      expired: false,
      attemptsRemaining: 5,
      sendsRemaining: 4,
      resendAvailableAt: new Date(Date.now() + 30_000).toISOString(),
      deliveryFailed: false,
    };
    const patches: Json[] = [];
    await page.route("**/api/sms/phone", (route) => json(route, phoneState(verified ? ACTIVE_CONTACT : null)));
    await page.route("**/api/sms/phone/start", (route) => json(route, phoneState(null, pending)));
    await page.route("**/api/sms/phone/verify", (route) => {
      verified = true;
      return json(route, { ...phoneState(), transferred: false, replaced: false });
    });
    let current = overview({ subscribed: false });
    await page.route("**/api/sms/huahua", async (route) => {
      if (route.request().method() === "PATCH") {
        const patch = route.request().postDataJSON() as Json;
        patches.push(patch);
        current = { ...current, preferences: { ...current.preferences, ...patch } };
      }
      await json(route, current);
    });

    await page.goto("/dev/huahua?view=onboarding");
    await page.getByPlaceholder("Mobile number").fill("4165554567");
    await expect(page.getByRole("button", { name: "Text me a code" })).toBeDisabled();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Text me a code" }).click();
    await page.getByLabel(/Enter the 6-digit code/).fill("123456");
    await page.getByRole("button", { name: "Verify" }).click();

    await expect(page.getByText("You're all set to text 华华!")).toBeVisible();
    const style = page.getByTestId("huahua-onboarding-style");
    await expect(style).toBeVisible();
    await expect(style.getByRole("radio", { name: /Focused coach/ })).toHaveCount(0);
    await style.getByRole("radio", { name: /Coach/ }).check();
    await expect(style.getByText(/Saved/)).toBeVisible();
    await expect(style.getByRole("radio", { name: /Coach/ })).toBeChecked();
    expect(patches).toEqual([{ correctionMode: "coach" }]);
    await page.screenshot({ path: "test-results/huahua-onboarding-mobile.png", fullPage: true });
  });

  test("lets learners register interest in another country", async ({ page }) => {
    await page.route("**/api/sms/phone", (route) => json(route, phoneState(null)));
    let interest: Json | null = null;
    await page.route("**/api/sms/huahua/interest", (route) => {
      interest = route.request().postDataJSON() as Json;
      return json(route, { ok: true, country: { code: "GB", name: "United Kingdom" } });
    });
    await page.goto("/dev/huahua?view=onboarding");
    await page.getByRole("button", { name: "My country isn't listed" }).click();
    await page.getByLabel(/Where are you/).selectOption("GB");
    await page.getByRole("button", { name: "Tell me when it's ready" }).click();
    await expect(page.getByText(/let you know when texting is available/)).toBeVisible();
    expect(interest).toEqual({ country: "GB" });
  });
});
