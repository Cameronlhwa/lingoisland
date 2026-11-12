import {PREVIEW_STORAGE_KEY} from "../../../lib/testing/config";
import { compileTemplate } from "../../../lib/onboarding/personalized/firstLesson/templates";
import { personalizedLesson } from "../../../lib/onboarding/personalized/firstLesson/personalization";
import { expect, type Page, type Locator } from "@playwright/test";
import { getLessonById } from "../../../lib/onboarding/personalized/firstLesson/bank";
export async function advanceLesson(page: Page, until = "complete", press: (locator: Locator) => Promise<void> = locator => locator.click()) {
  const root = page.getByTestId("first-lesson");
  const familiarity=page.getByRole("heading",{name:"A quick familiarity check."});
  await expect(root.or(familiarity)).toBeVisible({timeout:30000});
  if(await familiarity.isVisible()) {await page.getByRole("button",{name:"I know all of these"}).click();await page.getByRole("button",{name:"Continue",exact:true}).click();}
  await expect(root).toBeVisible();
  const storageKey = page.url().includes("/admin/testing") ? PREVIEW_STORAGE_KEY : "lingo_onboarding_v2";
  const storedAnswers = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).answers, storageKey);
  const lesson = storedAnswers.firstLesson.templatePlan ? compileTemplate(storedAnswers.firstLesson.templatePlan) : getLessonById((await root.getAttribute("data-lesson-id"))!) ?? (storedAnswers.firstLesson.generated ? personalizedLesson(storedAnswers.firstLesson.generated, storedAnswers) : null);
  if (!lesson) throw new Error("Missing authored lesson");
  for (let i = 0; i < 40; i++) {
    const phase = await root.getAttribute("data-lesson-phase");
    const teachingIndex = await root.getAttribute("data-teaching-index");
    if (phase === until || phase === "complete" || (until === "recognize" && phase === "beginner_recall")) return;
    switch (phase) {
      case "intro": await press(page.getByTestId("lesson-start")); break;
      case "teach_first": case "teach_second": await press(page.getByTestId("lesson-teach-continue")); break;
      case "beginner_recall": case "recognize": case "listen": case "baseline": case "coach": {
        if (phase === "baseline") await press(page.getByTestId("lesson-cant-speak"));
        const showText = page.getByRole("button", { name: "Can’t listen? Show the word", exact: true });
        if (await showText.isVisible()) await press(showText);
        const target = phase === "recognize" || phase === "baseline" ? lesson.match[0] : (lesson.match[1] ?? lesson.match[0]);
        const targetId = await page.getByTestId("lesson-quiz").getAttribute("data-target-id") ?? target.id;
        await press(page.getByTestId(`quiz-choice-${targetId}`));
        await press(page.getByTestId("lesson-quiz-check"));
        await press(page.getByTestId("lesson-quiz-check"));
        break;
      }
      case "beginner_match": case "meaning":
        for (const p of lesson.match) { if (!await page.getByTestId(`match-tile-${p.id}`).isVisible()) continue; await press(page.getByTestId(`match-tile-${p.id}`)); await press(page.getByTestId(`match-slot-${p.id}`)); }
        await press(page.getByTestId("lesson-match-continue")); break;
      case "frame": await press(page.getByRole("button", { name: /^(Try building it|Practice using it)$/ })); break;
      case "revisit":
        if(await page.getByTestId("lesson-quiz").isVisible()) {
          const pair=lesson.match.find(p=>storedAnswers.firstLesson.mistakes?.includes(p.id))??lesson.match[0];
          await press(page.getByTestId(`quiz-choice-${pair.id}`));
          await press(page.getByTestId("lesson-quiz-check")); await press(page.getByTestId("lesson-quiz-check"));break;
        }
        // A mission/slot mistake gets another sentence transfer instead.
      case "supported": case "build": case "transfer": {
        const build = (phase === "transfer" || phase === "revisit") ? lesson.transferBuild : lesson.build;
        for (const id of phase === "build" ? build.order : [build.slotId ?? build.order[1] ?? build.order[0]]) await press(page.getByTestId(`build-chunk-${id}`));
        await press(page.getByTestId("lesson-build-check")); await press(page.getByTestId("lesson-build-continue")); break;
      }
      case "prepare":
        if(await page.getByTestId("lesson-quiz").isVisible()) {
          const w=lesson.template?.incomingTeaching[0];
          const pair=lesson.match.find(p=>p.hanzi===w?.hanzi) ?? lesson.match[0];
          await press(page.getByTestId(`quiz-choice-${pair.id}`));
          await press(page.getByTestId("lesson-quiz-check")); await press(page.getByTestId("lesson-quiz-check"));
        }
        await press(page.getByTestId("lesson-start-chat")); break;
      case "chat":
        if (await page.getByTestId("lesson-chat-finish").isVisible()) { await press(page.getByTestId("lesson-chat-finish")); }
        else { await press(page.getByTestId(`lesson-choice-${lesson.chat.expectedChoiceId}`)); await press(page.getByTestId("lesson-chat-skip-speak")); await expect(page.getByTestId("lesson-chat-finish")).toBeEnabled(); await press(page.getByTestId("lesson-chat-finish")); }
        break;
      default: throw new Error(`Unexpected lesson phase: ${phase}`);
    }
    await expect.poll(async()=>`${await root.getAttribute("data-lesson-phase")}:${await root.getAttribute("data-teaching-index")}`).not.toBe(`${phase}:${teachingIndex}`);
  }
  throw new Error("Lesson did not complete");
}
export async function finishFirstLesson(page: Page, press?: (locator: Locator) => Promise<void>) {
  await advanceLesson(page, "complete", press);
  await (press ? press(page.getByTestId("lesson-to-commitment")) : page.getByTestId("lesson-to-commitment").click());
}
