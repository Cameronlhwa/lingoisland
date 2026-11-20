import {makeBudgetCourse,type CourseTier} from "../../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
import {grammarSteps} from "../../../lib/onboarding/personalized/firstLesson/grammarSequence";
import {updatedFirstLesson} from "../../../lib/onboarding/personalized/firstLesson/curriculum";
import {PREVIEW_STORAGE_KEY} from "../../../lib/testing/config";
import { compileTemplate } from "../../../lib/onboarding/personalized/firstLesson/templates";
import { personalizedLesson } from "../../../lib/onboarding/personalized/firstLesson/personalization";
import { expect, type Page, type Locator } from "@playwright/test";
import { getLessonById } from "../../../lib/onboarding/personalized/firstLesson/bank";
export async function advanceLesson(page: Page, until = "complete", press: (locator: Locator) => Promise<void> = locator => locator.click()) {
  const root = page.getByTestId("first-lesson");
  const familiarity=page.getByRole("heading",{name:"A quick familiarity check."});
  const placement=page.getByTestId("course-placement");
  await expect(root.or(familiarity).or(placement)).toBeVisible({timeout:30000});
  if(await placement.isVisible()){
    const tier=Number(await placement.getAttribute("data-course-tier")) as CourseTier;
    const storageKey=page.url().includes("/admin/testing")?PREVIEW_STORAGE_KEY:"lingo_onboarding_v2";
    const answers=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).answers,storageKey);
    const course=makeBudgetCourse(tier,answers.goal.primary??"other",Number(await placement.getAttribute("data-course-variant")));
    await page.getByTestId("vocabulary-know-none").click();
    for(const id of course.budget.prerequisiteIds)await page.getByTestId(`known-word-${id}`).click();
    await page.getByTestId("course-placement-continue").click();
  }
  if(await familiarity.isVisible()) {await page.getByRole("button",{name:"I know all of these"}).click();await page.getByRole("button",{name:"Continue",exact:true}).click();}
  await expect(root).toBeVisible();
  const storageKey = page.url().includes("/admin/testing") ? PREVIEW_STORAGE_KEY : "lingo_onboarding_v2";
  const storedAnswers = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).answers, storageKey);
  const lesson = updatedFirstLesson(storedAnswers) ?? (storedAnswers.firstLesson.templatePlan ? compileTemplate(storedAnswers.firstLesson.templatePlan) : getLessonById((await root.getAttribute("data-lesson-id"))!) ?? (storedAnswers.firstLesson.generated ? personalizedLesson(storedAnswers.firstLesson.generated, storedAnswers) : null));
  if (!lesson) throw new Error("Missing authored lesson");
  for (let i = 0; i < 100; i++) {
    const phase = await root.getAttribute("data-lesson-phase");
    const teachingIndex = await root.getAttribute("data-teaching-index");
    const beforeSubstep = lesson.curriculum ? await page.locator("[data-grammar-index], [data-match-round], [data-vocabulary-step]").evaluateAll(nodes=>nodes.map(n=>n.getAttribute("data-grammar-index")??n.getAttribute("data-match-round")??`${n.getAttribute("data-vocabulary-step")}:${n.getAttribute("data-vocabulary-index")}`).join(":")) : "";
    if (phase === until || (until === "recognize" && lesson.curriculum && phase === "meaning") || phase === "complete" || (until === "recognize" && phase === "beginner_recall")) return;
    switch (phase) {
      case "intro": await press(page.getByTestId("lesson-start")); break;
      case "vocabulary": {
        const stage=await page.getByTestId("lesson-vocabulary").getAttribute("data-vocabulary-step");
        if(stage==="check"){await press(page.getByTestId("vocabulary-confirm"));break;}
        if(stage==="known"){await press(page.getByRole("button",{name:"Continue to grammar",exact:true}));break;}
        if(stage==="teach"){await press(page.getByTestId("lesson-teach-continue"));break;}
        if(await page.getByTestId("lesson-match").isVisible()){
          for(const pair of lesson.match){const tile=page.getByTestId(`match-tile-${pair.id}`);if(await tile.isVisible() && await tile.isEnabled()){await press(tile);await press(page.getByTestId(`match-slot-${pair.id}`));}}
          await press(page.getByTestId("lesson-match-continue"));
        }else{const target=await page.getByTestId("lesson-quiz").getAttribute("data-target-id");await press(page.getByTestId(`quiz-choice-${target}`));await press(page.getByTestId("lesson-quiz-check"));await press(page.getByTestId("lesson-quiz-check"));}
        break;
      }
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
      case "frame":
        if(lesson.curriculum){
          const index=Number(await page.getByTestId("grammar-practice").getAttribute("data-grammar-index"));
          const step=grammarSteps(lesson.curriculum)[index];
          if(step.kind==="teach"){await press(page.getByTestId("grammar-continue"));break;}
          const practice=step.practice;
          if(practice.kind==="build"){
            for(const id of practice.build.order)await press(page.getByTestId(`build-chunk-${id}`));
            await press(page.getByTestId("lesson-build-check"));await press(page.getByTestId("lesson-build-continue"));
          }else if(practice.kind==="reading")await press(page.getByTestId("reading-continue"));
          else if(practice.kind==="writing"){
            await page.getByTestId("writing-answer").fill(practice.sample.hanzi);await press(page.getByTestId("writing-check"));
            if(await page.getByTestId("writing-reviewed").isVisible())await page.getByTestId("writing-reviewed").check();
            await press(page.getByTestId("writing-check"));
          }else{await press(page.getByTestId(`grammar-option-${practice.correct??practice.choices[0].id}`));await press(page.getByTestId("grammar-check"));await press(page.getByTestId("grammar-check"));}
        }else await press(page.getByRole("button", { name: /^(Try building it|Practice using it)$/ }));
        break;
      case "note": await press(page.getByTestId("lesson-note-continue")); break;
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
      case "chat": case "discussion": {
        const chat = phase === "discussion" ? lesson.curriculum!.discussion! : lesson.chat;
        if (await page.getByTestId("lesson-chat-finish").isVisible()) { await press(page.getByTestId("lesson-chat-finish")); }
        else { await press(page.getByTestId(`lesson-choice-${chat.expectedChoiceId}`)); await press(page.getByTestId("lesson-chat-skip-speak")); await expect(page.getByTestId("lesson-chat-finish")).toBeEnabled(); await press(page.getByTestId("lesson-chat-finish")); }
        break;
      }
      default: throw new Error(`Unexpected lesson phase: ${phase}`);
    }
    await expect.poll(async()=>`${await root.getAttribute("data-lesson-phase")}:${await root.getAttribute("data-teaching-index")}:${await page.locator("[data-grammar-index], [data-match-round], [data-vocabulary-step]").evaluateAll(nodes=>nodes.map(n=>n.getAttribute("data-grammar-index")??n.getAttribute("data-match-round")??`${n.getAttribute("data-vocabulary-step")}:${n.getAttribute("data-vocabulary-index")}`).join(":"))}`).not.toBe(`${phase}:${teachingIndex}:${beforeSubstep}`);
  }
  throw new Error("Lesson did not complete");
}
export async function finishFirstLesson(page: Page, press?: (locator: Locator) => Promise<void>) {
  await advanceLesson(page, "complete", press);
  await (press ? press(page.getByTestId("lesson-to-commitment")) : page.getByTestId("lesson-to-commitment").click());
}
