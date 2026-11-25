import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { verifyLessonAdvance } from "../../lib/journey/teaching/assessment";
import { lesson } from "../journey/fixtures";
import { createHash } from "node:crypto";
import { compileJourneyLesson, selectObjective, type JourneyLesson } from "../../lib/journey/teaching/curriculum";

const writingLesson = compileJourneyLesson("island", "SaaS Basics — SaaS", selectObjective("B1", 1), {
  hanzi: "还是 / 或者", pinyin: "háishi / huòzhě", english: "or", pattern: "A 还是 B / A 或者 B",
  whenToUse: "Use 还是 to ask a choice question and 或者 to describe alternatives.",
  examples: [
    { tier: "warmup", hanzi: "你想按月订阅还是按年订阅？", pinyin: "nǐ xiǎng àn yuè dìngyuè háishi àn nián dìngyuè", english: "Would you like a monthly or annual subscription?" },
    { tier: "target", hanzi: "你可以按月订阅或者按年订阅。", pinyin: "nǐ kěyǐ àn yuè dìngyuè huòzhě àn nián dìngyuè", english: "You can subscribe monthly or annually." },
  ],
}, [{ id: "subscribe", hanzi: "订阅", pinyin: "dìngyuè", english: "subscribe" }]);
import { lessonStepIds, updateLessonProgress, type LessonProgress } from "../../lib/journey/teaching/curriculum";
import { grammarSteps } from "../../lib/lessons/grammarSequence";

// Render the actual player without bypassing authentication on a production route.
// This temporary route exists only during this browser suite and is removed afterward.
const fixturePath = "app/journey-teaching-browser-test";
test.describe.configure({ mode: "serial" });
test.use({ launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] } });
test.beforeAll(() => {
  mkdirSync(fixturePath, { recursive: true });
  mkdirSync(`${fixturePath}/[id]`, { recursive: true });
  writeFileSync(`${fixturePath}/[id]/page.tsx`, 'export { default } from "@/app/app/topic-islands/[id]/learn/page";\n');
  writeFileSync(`${fixturePath}/page.tsx`, 'export { default } from "@/tests/e2e/helpers/JourneyTeachingHarness";\n');
});
test.afterAll(() => {
  rmSync(fixturePath, { recursive: true, force: true });
  rmSync(".next/types/app/journey-teaching-browser-test", { recursive: true, force: true });
});

async function setup(page: Page, initial: LessonProgress = { stepId: "vocabulary" }, failFirstSave = false, saveDelayMs = 0, content: JourneyLesson = lesson) {
  let progress = initial, revision = 0, saves = 0;
  let writingApproval: { stepId: string; answerHash: string } | null = null;
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      cancel() {}, speak(utterance: SpeechSynthesisUtterance) { setTimeout(() => utterance.onend?.(new Event("end") as SpeechSynthesisEvent), 20); },
    } });
  });
  await page.route("**/api/profile", route => route.fulfill({ json: {} }));
  await page.route("**/api/journey-teaching-fixture", route => route.fulfill({ json: { lesson: content, progress, revision } }));
  await page.route("**/api/topic-islands/island/lesson-progress", async route => {
    const body = route.request().postDataJSON(); saves++;
    if (saveDelayMs) await new Promise(resolve => setTimeout(resolve, saveDelayMs));
    if (failFirstSave && saves === 1) return route.fulfill({ status: 503, json: { error: "Could not save progress" } });
    expect(body.revision).toBe(revision);
    const next = updateLessonProgress(content, progress, body.progress);
    verifyLessonAdvance(content, progress, next, body.evidence, writingApproval);
    progress = next; revision++;
    return route.fulfill({ json: { progress, revision } });
  });
  await page.route("**/api/topic-islands/island/lesson-writing", route => {
    const body = route.request().postDataJSON();
    expect(body.stepId).toBe(progress.stepId);
    writingApproval = { stepId: body.stepId, answerHash: createHash("sha256").update(body.answer).digest("hex") };
    return route.fulfill({ json: { status: "correct", feedback: "Good use of a choice question." } });
  });
  await page.route("**/api/learn-chat", route => {
    expect(route.request().postDataJSON().lessonIslandId).toBe("island");
    return route.fulfill({ json: { message: "你好，你想要什么？" } });
  });
  await expect(async () => {
    await page.goto("/journey-teaching-browser-test");
    await expect(page.getByTestId("journey-mini-lesson")).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 60000, intervals: [500, 1000] });
  return () => progress;
}

test("journey teaching resumes, teaches and checks grammar, then completes listening and conversation", async ({ page }) => {
  test.setTimeout(120000);
  const progress = await setup(page);
  await page.getByTestId("vocabulary-know-all").click();
  await expect(page.getByTestId("vocabulary-confirm")).toBeEnabled();
  await page.getByTestId("vocabulary-confirm").click();
  await expect(page.getByTestId("grammar-teaching")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("grammar-teaching")).toBeVisible();
  await page.getByTestId("grammar-continue").click();
  for (const step of grammarSteps(lesson.curriculum).filter(step => step.kind !== "teach")) {
    if (step.practice.kind !== "build") throw new Error("Expected a sentence check");
    await expect(page.getByTestId("grammar-practice")).toHaveAttribute("data-grammar-step", step.id);
    for (const id of step.practice.build.order) await page.getByTestId(`build-chunk-${id}`).click();
    await page.getByTestId("lesson-build-check").click();
    await page.getByTestId("lesson-build-continue").click();
  }
  await expect(page.getByTestId("journey-speaking")).toBeVisible();
  await page.getByRole("button", { name: "Listen to the sentence", exact: true }).click();
  await page.getByRole("button", { name: "Continue with listening practice" }).click();
  await page.getByRole("button", { name: "Start the conversation" }).click();
  await page.getByLabel("Your reply in Mandarin").fill("我想要一杯美式。");
  await page.getByRole("button", { name: "Send reply" }).click();
  await expect(page.getByRole("button", { name: "Finish this lesson" })).toBeEnabled();
  await page.reload();
  await expect(page.getByText("我想要一杯美式。", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Finish this lesson" }).click();
  await expect(page.getByTestId("journey-lesson-complete")).toBeVisible();
  expect(progress().stepId).toBe("complete");
  expect(progress().speakingPath).toBe("listening");
});

test("failed saves stay on the activity and can be retried", async ({ page }) => {
  const progress = await setup(page, { stepId: lessonStepIds(lesson)[1] }, true);
  await page.getByTestId("grammar-continue").click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not save progress" })).toContainText("Could not save progress");
  expect(progress().stepId).toBe(lessonStepIds(lesson)[1]);
  await page.getByRole("button", { name: "Retry saving" }).click();
  await expect(page.getByTestId("grammar-practice")).toHaveAttribute("data-grammar-kind", "check");
});

test("shared grammar teaching fits desktop and mobile", async ({ page }) => {
  await setup(page, { stepId: lessonStepIds(lesson)[1] });
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByTestId("grammar-teaching")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width !== 320) await page.screenshot({ path: `/tmp/journey-teaching-${width}.png`, fullPage: true, animations: "disabled" });
  }
});

test("speaking records the lesson sentence and connects its scoring session", async ({ page }) => {
  await page.context().grantPermissions(["microphone"]);
  const progress = await setup(page, { stepId: "speaking" });
  await page.route("**/api/topic-islands/island/lesson-speaking", route => route.fulfill({ json: { sessionId: "lesson-speaking-session" } }));
  let scored = false;
  await page.route("**/api/pronunciation/score", route => {
    const body = route.request().postDataBuffer()!.toString();
    expect(body).toContain(lesson.speaking.hanzi);
    expect(body).toContain("lesson-speaking-session");
    expect(body).toContain("item-0"); scored = true;
    return route.fulfill({ json: { attemptId: "attempt-1", overallScore: 90, score: { overall: 90, characters: [] }, weakSyllables: [] } });
  });
  await page.getByRole("button", { name: "Practise my pronunciation", exact: true }).click();
  await page.getByRole("button", { name: "Tap to record" }).click();
  await expect(page.getByRole("button", { name: "Stop recording" })).toBeVisible();
  await page.waitForTimeout(900); // Capture enough fake microphone audio to exercise WAV encoding.
  await page.getByRole("button", { name: "Stop recording" }).click();
  await page.getByRole("button", { name: "Practise with Huahua", exact: true }).click();
  await expect(page.getByTestId("journey-conversation")).toBeVisible();
  expect(scored).toBe(true); expect(progress().speakingPath).toBe("spoken");
});


test("rapid word selections remain responsive and persist the latest choice", async ({ page }) => {
  const progress = await setup(page, { stepId: "vocabulary" }, false, 900);
  const coffee = page.getByTestId("known-word-coffee"), americano = page.getByTestId("known-word-americano");
  await coffee.click();
  await expect(coffee).toHaveAttribute("aria-pressed", "true", { timeout: 400 });
  await expect(americano).toBeEnabled();
  await americano.click();
  await coffee.click();
  await expect(coffee).toHaveAttribute("aria-pressed", "false", { timeout: 400 });
  await expect(americano).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("vocabulary-confirm")).toBeDisabled();
  await expect(page.getByTestId("vocabulary-confirm")).toBeEnabled();
  expect(progress().vocabularyKnownIds).toEqual(["americano"]);
  await page.reload();
  await expect(coffee).toHaveAttribute("aria-pressed", "false");
  await expect(americano).toHaveAttribute("aria-pressed", "true");
});

test("retry preserves the latest selection after a failed background save", async ({ page }) => {
  const progress = await setup(page, { stepId: "vocabulary" }, true, 900);
  await page.getByTestId("known-word-coffee").click();
  await page.getByTestId("known-word-americano").click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not save progress" })).toBeVisible();
  await page.getByRole("button", { name: "Retry saving" }).click();
  await expect(page.getByTestId("vocabulary-confirm")).toBeEnabled();
  expect(progress().vocabularyKnownIds).toEqual(["coffee", "americano"]);
  await page.reload();
  await expect(page.getByTestId("known-word-coffee")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("known-word-americano")).toHaveAttribute("aria-pressed", "true");
});

test("vocabulary layout fits small screens and respects reduced motion", async ({ page }) => {
  await setup(page);
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByTestId("vocabulary-confirm")).toBeVisible();
    if (width !== 320) await page.screenshot({ path: `/tmp/journey-vocabulary-${width}.png`, fullPage: true, animations: "disabled" });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await page.getByTestId("known-word-coffee").evaluate(element => getComputedStyle(element).transitionDuration)).toBe("0s");
});


test("writing autosaves preserve focus, edits and grading feedback without reloading", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const progress = await setup(page, { stepId: "practice:1" }, false, 1200, writingLesson);
  const answer = page.getByTestId("writing-answer");
  await answer.fill("你想按月订阅还是按年订阅？");
  await page.waitForRequest(request => request.url().endsWith("/lesson-progress"));
  await expect(answer).toBeEnabled({ timeout: 400 });
  await expect(answer).toBeFocused();
  await answer.press("End");
  await answer.press("Backspace");
  await answer.pressSequentially("？");
  await page.getByTestId("writing-check").click();
  await expect(page.getByText("Good use of a choice question.")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "All progress saved" })).toBeVisible();
  await expect(answer).toHaveValue("你想按月订阅还是按年订阅？");
  await expect(page.getByText("Good use of a choice question.")).toBeVisible();
  expect(progress().writingResponses?.["practice:1"]).toBe("你想按月订阅还是按年订阅？");
  expect(errors).toEqual([]);
  await page.getByTestId("writing-check").click();
  await expect(page.getByTestId("journey-speaking")).toBeVisible();
});

test("a writing check error keeps the answer and only retries when asked", async ({ page }) => {
  await setup(page, { stepId: "practice:1" }, false, 0, writingLesson);
  let checks = 0;
  await page.route("**/api/topic-islands/island/lesson-writing", route => {
    checks++;
    return route.fulfill({ status: 503, json: { error: "Grading temporarily unavailable" } });
  });
  await page.getByTestId("writing-answer").fill("你想按月订阅还是按年订阅？");
  await page.getByTestId("writing-check").click();
  await expect(page.getByText("We couldn’t check your answer just now. Please try again.")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "All progress saved" })).toBeVisible();
  expect(checks).toBe(1);
  await expect(page.getByTestId("writing-answer")).toHaveValue("你想按月订阅还是按年订阅？");
  await expect(page.getByTestId("writing-check")).toHaveText("Try again");
});

test("query updates do not reload an active lesson or discard writing feedback", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await setup(page, { stepId: "practice:1" }, false, 0, writingLesson);
  let loads = 0;
  await page.route("**/api/topic-islands/island", route => {
    loads++;
    return route.fulfill({ json: { island: { id: "island" }, words: [], learn_ready: true,
      teaching: { lesson: writingLesson, progress: { stepId: "practice:1" }, revision: 0 } } });
  });
  await page.goto("/journey-teaching-browser-test/island?journeyFirst=1");
  await expect(page.getByTestId("writing-answer")).toBeVisible();
  await page.getByTestId("writing-answer").fill("你想按月订阅还是按年订阅？");
  await page.getByTestId("writing-check").click();
  await expect(page.getByText("Good use of a choice question.")).toBeVisible();
  const initialLoads = loads; // Development Strict Mode may perform an initial aborted fetch.
  await page.evaluate(() => window.history.replaceState(null, "", "?journeyFirst=1&view=lesson"));
  await expect(page.getByRole("status").filter({ hasText: "All progress saved" })).toBeVisible();
  await expect(page.getByText("Good use of a choice question.")).toBeVisible();
  expect(loads).toBe(initialLoads);
  expect(errors).toEqual([]);
});


test("minimal lesson loading fits desktop and mobile, then opens the prepared lesson", async ({ page }) => {
  await setup(page);
  await page.route("**/api/journey-teaching-fixture", route => route.fulfill({ json: { lesson: null, progress: { stepId: "vocabulary" }, revision: 0 } }));
  let release!: () => void;
  const prepared = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/topic-islands/island/lesson", async route => {
    await prepared;
    return route.fulfill({ json: { lesson, progress: { stepId: "vocabulary" }, revision: 0 } });
  });
  await page.reload();
  const loading = page.getByTestId("journey-loading");
  try {
    await expect(loading).toBeVisible();
    await expect(loading.getByRole("heading", { name: "A little closer to your next conversation." })).toBeVisible();
    await expect(loading).not.toContainText("example sentences");
    await expect(loading.getByRole("progressbar")).toHaveCount(0);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (width !== 320) await page.screenshot({ path: `/tmp/journey-minimal-loading-${width}.png`, animations: "disabled", fullPage: true });
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await loading.locator('[aria-hidden="true"]').first().evaluate(element => getComputedStyle(element).animationName)).toBe("none");
  } finally { release(); }
  await expect(page.getByTestId("lesson-vocabulary")).toBeVisible();
});

test("minimal preparation keeps an accessible retry after a failed request", async ({ page }) => {
  await setup(page);
  await page.route("**/api/journey-teaching-fixture", route => route.fulfill({ json: { lesson: null, progress: { stepId: "vocabulary" }, revision: 0 } }));
  let attempts = 0;
  await page.route("**/api/topic-islands/island/lesson", route => {
    attempts++;
    return attempts === 1
      ? route.fulfill({ status: 503, json: { error: "Your lesson couldn’t load. Please try again." } })
      : route.fulfill({ json: { lesson, progress: { stepId: "vocabulary" }, revision: 0 } });
  });
  await page.reload();
  await expect(page.getByRole("alert").filter({ hasText: "Your lesson couldn’t load." })).toBeVisible();
  await expect(page.getByTestId("journey-loading").getByRole("status")).toHaveCount(0);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByTestId("lesson-vocabulary")).toBeVisible();
});

test("guided chat keeps suggestions editable, saves them and fits desktop and mobile", async ({ page }) => {
  const progress = await setup(page, { stepId: "chat", chatMessages: [{ role: "assistant", content: "你想按月订阅还是按年订阅？", suggestions: ["按月订阅", "按年订阅"] }] }, false, 300, writingLesson);
  const chat = page.getByTestId("journey-conversation");
  await expect(chat.getByRole("img")).toHaveAttribute("src", "/characters/capybara-profile.png");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 960 : 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const box = await chat.getByRole("button", { name: "Send reply", exact: true }).boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(width === 1440 ? 960 : 844);
    if (width !== 320) await page.screenshot({ path: `/tmp/journey-chat-${width}.png`, fullPage: true, animations: "disabled" });
  }
  let translations = 0;
  await page.route("**/api/story/english", route => {
    translations++;
    return route.fulfill({ json: { english: "Would you like a monthly or yearly subscription?" } });
  });
  await chat.getByRole("button", { name: "Show meaning", exact: true }).click();
  await expect(chat.getByText("Would you like a monthly or yearly subscription?", { exact: true })).toBeVisible();
  await chat.getByRole("button", { name: "Hide meaning", exact: true }).click();
  await expect(chat.getByText("Would you like a monthly or yearly subscription?", { exact: true })).toHaveCount(0);
  await chat.getByRole("button", { name: "Show meaning", exact: true }).click();
  expect(translations).toBe(1);
  let requests = 0;
  await page.route("**/api/learn-chat", async route => {
    requests++;
    const body = route.request().postDataJSON();
    expect(body.replySuggestions).toBe(true);
    expect(body.messages.at(-1).content).toBe("我喜欢按月订阅。");
    await new Promise(resolve => setTimeout(resolve, 400));
    return route.fulfill({ json: { message: "你喜欢用电脑还是手机？", suggestions: ["电脑", "手机"] } });
  });
  await chat.getByRole("button", { name: "按月订阅", exact: true }).click();
  const reply = page.getByLabel("Your reply in Mandarin");
  await expect(reply).toHaveValue("按月订阅");
  await expect(reply).toBeFocused();
  expect(requests).toBe(0);
  await reply.fill("我喜欢按月订阅。");
  await reply.press("Enter");
  await expect(chat.getByText("Huahua is replying…", { exact: true })).toBeVisible();
  await expect(chat.getByRole("button", { name: "电脑", exact: true })).toBeEnabled();
  expect(requests).toBe(1);
  expect(progress().chatMessages?.at(-1)?.suggestions).toEqual(["电脑", "手机"]);
  await page.reload();
  await expect(chat.getByRole("button", { name: "电脑", exact: true })).toBeVisible();
  await expect(chat.getByText("我喜欢按月订阅。", { exact: true })).toBeVisible();
});

test("a failed chat request preserves the draft and can be retried without duplicate turns", async ({ page }) => {
  const progress = await setup(page, { stepId: "chat", chatMessages: [{ role: "assistant", content: "你想喝什么？" }] });
  let attempts = 0;
  await page.route("**/api/learn-chat", route => {
    attempts++;
    return attempts === 1 ? route.fulfill({ status: 503, json: { error: "Chat is temporarily unavailable." } })
      : route.fulfill({ json: { message: "好的！", suggestions: [] } });
  });
  const reply = page.getByLabel("Your reply in Mandarin");
  await reply.fill("我想喝咖啡。");
  await reply.dispatchEvent("keydown", { key: "Enter", code: "Enter", isComposing: true });
  expect(attempts).toBe(0);
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect(page.getByTestId("journey-conversation").getByRole("alert")).toContainText("Your reply is still here.");
  await expect(reply).toHaveValue("我想喝咖啡。");
  expect(progress().chatMessages).toHaveLength(1);
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect(page.getByRole("button", { name: "Finish this lesson", exact: true })).toBeEnabled();
  expect(progress().chatMessages?.filter(message => message.role === "user")).toHaveLength(1);
});

test("saved chat hides pinyin by default and places legacy hints above the reply bar", async ({ page }) => {
  const pronunciation = "Nǐ gèng cháng yòng diànnǎo, háishi shǒujī app?";
  const question = "你更常用电脑，还是手机 app？";
  const saved = `${question}\n(${pronunciation})\nHint: answer “电脑” or “手机 app”.`;
  await setup(page, { stepId: "chat", chatMessages: [{ role: "assistant", content: saved }] }, false, 0, writingLesson);
  const chat = page.getByTestId("journey-conversation");
  await expect(chat.getByText(question, { exact: true })).toBeVisible();
  await expect(chat.getByText(pronunciation, { exact: true })).toHaveCount(0);
  await expect(chat).not.toContainText("Hint: answer");
  const toggle = chat.getByRole("button", { name: "Show pinyin", exact: true });
  await toggle.click();
  await expect(chat.getByText(pronunciation, { exact: true })).toBeVisible();
  await chat.getByRole("button", { name: "Hide pinyin", exact: true }).click();
  await expect(chat.getByText(pronunciation, { exact: true })).toHaveCount(0);
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 960 : 844 });
    const chip = chat.getByRole("button", { name: "电脑", exact: true });
    const input = page.getByLabel("Your reply in Mandarin");
    const chipBox = await chip.boundingBox(), inputBox = await input.boundingBox();
    expect(chipBox!.y + chipBox!.height).toBeLessThanOrEqual(inputBox!.y);
    expect(inputBox!.y - chipBox!.y - chipBox!.height).toBeLessThan(30);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width !== 320) await page.screenshot({ path: `/tmp/journey-chat-pinyin-${width}.png`, fullPage: true, animations: "disabled" });
  }
  await chat.getByRole("button", { name: "手机 app", exact: true }).click();
  await expect(page.getByLabel("Your reply in Mandarin")).toHaveValue("手机 app");
  await page.reload();
  await expect(chat.getByRole("button", { name: "Show pinyin", exact: true })).toBeVisible();
  await expect(chat.getByRole("button", { name: "电脑", exact: true })).toBeVisible();
});

for (const level of ["A0", "A1", "A2", "B1", "B2", "C1"]) test(`${level} chat starts, sends, shows support and resumes`, async ({ page }) => {
  const content: JourneyLesson = { ...lesson, objective: selectObjective(level, 1), mission: "Have a conversation about coffee." };
  const progress = await setup(page, { stepId: "chat" }, false, 0, content);
  let turns = 0;
  await page.route("**/api/learn-chat", route => {
    turns++;
    const body = route.request().postDataJSON();
    expect(body.replySuggestions).toBe(true);
    return route.fulfill({ json: turns === 1 ? { message: "你喜欢喝咖啡吗？", suggestions: ["喜欢", "不喜欢"] } : { message: "我也喜欢！你喜欢热的还是冰的？", suggestions: ["热的", "冰的"] } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Start the conversation", exact: true }).click();
  const chat = page.getByTestId("journey-conversation");
  await expect(chat.getByRole("button", { name: "Show pinyin", exact: true })).toBeVisible();
  await chat.getByRole("button", { name: "Show pinyin", exact: true }).click();
  await expect(chat.getByRole("button", { name: "Hide pinyin", exact: true })).toBeVisible();
  await chat.getByRole("button", { name: "喜欢", exact: true }).click();
  await expect(page.getByLabel("Your reply in Mandarin")).toHaveValue("喜欢");
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await expect(chat.getByRole("button", { name: "热的", exact: true })).toBeEnabled();
  expect(progress().chatMessages).toHaveLength(3);
  await page.reload();
  await expect(chat.getByText("喜欢", { exact: true })).toBeVisible();
  await expect(chat.getByRole("button", { name: "热的", exact: true })).toBeVisible();
  await chat.getByRole("button", { name: "Finish this lesson", exact: true }).click();
  await expect(page.getByTestId("journey-lesson-complete")).toBeVisible();
});

test("a saved fake-success reply can be recovered without duplicating the learner or clearing a draft", async ({ page }) => {
  const fallback = "Let's practice! Try using one of your new words in a sentence.";
  const progress = await setup(page, { stepId: "chat", chatMessages: [{ role: "assistant", content: "你更常用电脑还是手机？" }, { role: "user", content: "电脑" }, { role: "assistant", content: fallback }] });
  const chat = page.getByTestId("journey-conversation");
  await expect(chat).not.toContainText(fallback);
  await expect(chat.getByText("Huahua’s reply didn’t load.", { exact: true })).toBeVisible();
  await page.getByLabel("Your reply in Mandarin").fill("我想补充一点。");
  await page.route("**/api/learn-chat", route => {
    const history = route.request().postDataJSON().messages;
    expect(history).toHaveLength(2);
    expect(history.at(-1)).toEqual({ role: "user", content: "电脑" });
    expect(history.some((message: { content: string }) => message.content === fallback)).toBe(false);
    return route.fulfill({ json: { message: "我也喜欢用电脑。你常用什么软件？", suggestions: ["办公软件", "设计软件"] } });
  });
  await chat.getByRole("button", { name: "Retry Huahua’s reply", exact: true }).click();
  await expect(chat.getByRole("button", { name: "办公软件", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Your reply in Mandarin")).toHaveValue("我想补充一点。");
  expect(progress().chatMessages?.filter(message => message.role === "user")).toHaveLength(1);
  expect(progress().chatMessages?.some(message => message.content === fallback)).toBe(false);
});
