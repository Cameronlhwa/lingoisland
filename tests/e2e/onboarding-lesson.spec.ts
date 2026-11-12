import { mockMiniLessonFlag } from "./helpers/onboardingExperiment";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { initialState, LOCAL_STORAGE_KEY, stepsFor } from "../../lib/onboarding/personalized/flow";
import { VOCAB_BANK } from "../../lib/onboarding/personalized/vocabRecognition";
import { CHAT_TEMPLATES, compileTemplate, fallbackTemplatePlan, makeTemplatePlan, templateWords } from "../../lib/onboarding/personalized/firstLesson/templates";
import { advanceLesson, finishFirstLesson } from "./helpers/firstLesson";
test.use({ permissions:["microphone"], reducedMotion:"reduce", launchOptions:{args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream","--autoplay-policy=no-user-gesture-required"]} });
async function setup(page:Page,goal:"work"|"school"|"heritage"|"travel"|"everyday"|"other"="travel",level:"new"|"few_words"|"familiar_topics"="new",templateId?:string) {
 await mockMiniLessonFlag(page);
 const state=initialState(new Date(),"test"),a=state.answers;
 a.goal.primary=goal;a.interests.keys=goal==="work"?["meetings"]:goal==="travel"?["restaurants"]:["hobbies"];
 a.level.selfReport=level;
 a.vocabBasic={shownIds:["wo","ni","hao","shi"],selectedIds:level==="new"?[]:level==="few_words"?["wo"]:["wo","ni","hao","shi"],noneKnown:level==="new",skipped:false};
 const ids=VOCAB_BANK.filter(w=>w.hsk>=4).slice(0,4).map(w=>w.id);
 a.vocabAdvanced=level==="familiar_topics"?{shownIds:ids,selectedIds:ids.slice(0,2),noneKnown:false,skipped:false}:{shownIds:[],selectedIds:[],noneKnown:false,skipped:true};
 a.experience.key=level==="new"?"not_started":"under_6_months";
 a.usingPain={keys:["want_to_improve"],timing:"ongoing",upcomingText:null};a.learningPain={keys:["not_relevant"],hesitations:["dont_know_where_start"]};a.availability={minutes:"5",days:"3",session:null};
 let plan=fallbackTemplatePlan(a);
 if(templateId){const row=CHAT_TEMPLATES.find(t=>t.id===templateId)!;plan=makeTemplatePlan(a,row,templateWords(row).filter(w=>row.id==="work-2"?!["回复","什么时候"].includes(w.hanzi):!row.focus.includes(w.hanzi)).map(w=>w.hanzi));}
 plan.checked=true;a.firstLesson={...a.firstLesson,templatePlan:plan,lessonId:`template-${plan.templateId}`,selectionKey:plan.key};
 for(const step of stepsFor(a)){if(step==="first_lesson")break;state.events[step]={started_at:state.updatedAt,completed_at:state.updatedAt};}
 await page.addInitScript(({key,state})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));},{key:LOCAL_STORAGE_KEY,state});
 await page.route("**/api/onboarding/first-lesson",route=>route.fulfill({json:{plan}}));
 await page.route("**/api/onboarding/progress**",route=>route.fulfill({json:route.request().method()==="GET"?{account:{kind:"user",firstName:"Test"},progress:null}:{status:"saved",progress:{...route.request().postDataJSON().state,revision:1}}}));
 await page.route("**/api/onboarding/abandon**",route=>route.fulfill({json:{status:"ok"}}));await page.route("**/api/entitlements**",route=>route.fulfill({json:{isPro:false}}));
 await page.goto("/onboarding/journey?resume=first_lesson");await expect(page.getByTestId("lesson-intro")).toBeVisible({timeout:30000});return compileTemplate(plan);
}
for(const goal of ["work","school","heritage","travel","everyday","other"] as const)test(`beginner ${goal}: teaches every planned piece and completes the silent route`,async({page})=>{
 test.setTimeout(60000);const lesson=await setup(page,goal);await page.getByTestId("lesson-start").click();
 await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-lesson-phase","teach_first");await expect(page.getByTestId("lesson-quiz")).toHaveCount(0);
 expect(lesson.build.chunks.length).toBeGreaterThanOrEqual(2);await finishFirstLesson(page);await expect(page.getByRole("heading",{name:/Ready to continue/})).toBeVisible();
});
test("reply is taught separately from time choices; incoming when is explained and checked",async({page})=>{
 test.setTimeout(60000);const lesson=await setup(page,"work","few_words","work-2");await page.getByTestId("lesson-start").click();await expect(page.getByText("回复",{exact:true})).toBeVisible();
 await advanceLesson(page,"supported");await expect(page.getByTestId("build-chunk-slot-0")).toContainText("今天");await expect(page.getByTestId("build-chunk-slot-0")).not.toContainText("today");
 await advanceLesson(page,"prepare");await expect(page.getByText("什么时候",{exact:true}).first()).toBeVisible();await expect(page.getByTestId("lesson-message-explanation")).toContainText("time position");await expect(page.getByTestId("lesson-start-chat")).toHaveCount(0);
 await advanceLesson(page,"chat");const a=page.getByTestId("lesson-choice-reply-a"),b=page.getByTestId("lesson-choice-reply-b");
 await expect(a).not.toContainText(lesson.chat.choices[0].meaning);await expect(b).not.toContainText(lesson.chat.choices[1].meaning);await expect(page.getByTestId("lesson-chat-situation")).toContainText("tomorrow");
 await a.click();await page.getByTestId("lesson-chat-skip-speak").click();await expect(page.getByRole("status").filter({hasText:"valid Mandarin reply"})).toBeVisible();await expect(page.getByText("Delivered",{exact:true})).toHaveCount(0);
 await finishFirstLesson(page);await expect(page.getByRole("heading",{name:/Ready to continue/})).toBeVisible();
});
test("one-expression route skips filler drills and preserves progress and XP across reload",async({page})=>{
 test.setTimeout(60000);await setup(page,"everyday","familiar_topics","everyday-5");await advanceLesson(page,"supported");await expect(page.getByTestId("lesson-xp")).toHaveText("10 / 50 XP");
 await page.reload();await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-lesson-phase","supported");await advanceLesson(page);await expect(page.getByTestId("lesson-xp")).toHaveText("50 / 50 XP");
 await page.getByRole("button",{name:"Practice a little more"}).click();await advanceLesson(page);await expect(page.getByTestId("lesson-xp")).toHaveText("50 / 50 XP");
});
test("microphone denial allows the complete silent route",async({page})=>{
 test.setTimeout(60000);await setup(page);await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException("Denied","NotAllowedError"));});
 await advanceLesson(page,"baseline");await page.getByTestId("lesson-baseline-record").click();await expect(page.getByRole("status").filter({hasText:/Microphone unavailable/})).toBeVisible();
 await finishFirstLesson(page);await expect(page.getByRole("heading",{name:/Ready to continue/})).toBeVisible();
});
test("one pronunciation step shows character results, optional retry and chat reply",async({page})=>{
 test.setTimeout(90000);const targets:string[]=[];
 await page.route("**/api/onboarding/pronunciation",route=>{const body=route.request().postDataBuffer()!.toString();targets.push(body.includes("我要茶")?"tea":body.includes("我要咖啡")?"coffee":"unknown");return route.fulfill({json:{status:"ok",feedback:targets.length===1?"close":"great",overall:targets.length===1?50:87,tone:targets.length===1?45:90,weakSyllable:targets.length===1?"要":null,characters:[{hanzi:"我",pinyin:"wǒ",score:90,targetTone:3},{hanzi:"要",pinyin:"yào",score:targets.length===1?50:87,targetTone:4},{hanzi:targets.length===3?"咖啡":"茶",pinyin:"chá",score:70,targetTone:2}]}});});
 await setup(page);await advanceLesson(page,"baseline");await page.getByTestId("lesson-baseline-record").click();await expect(page.getByTestId("lesson-stop")).toBeVisible();await page.waitForTimeout(1600);await page.getByTestId("lesson-stop").click();
 await expect(page.getByTestId("pronunciation-piece-0")).toHaveAttribute("data-band","clear");
 await expect(page.getByTestId("pronunciation-piece-1")).toHaveAttribute("data-band","practice");
 await expect(page.getByTestId("pronunciation-piece-2")).toHaveAttribute("data-band","close");
 await page.getByTestId("pronunciation-piece-1").click();await expect(page.getByText(/Let this tone fall firmly/)).toBeVisible();
 await page.setViewportSize({width:390,height:844});
 await expect(page.getByTestId("pronunciation-results")).not.toContainText(/Sentence score|100|80\+/);
 const results=await new AxeBuilder({page}).include("#onboarding-main").withTags(["wcag2a","wcag2aa"]).analyze();expect(results.violations.map(v=>v.id)).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:"/tmp/lingo-compact-results/mobile-results.png",fullPage:true});
 await page.getByTestId("lesson-coach-record").click();await page.waitForTimeout(1600);await page.getByTestId("lesson-stop").click();
 await expect(page.getByTestId("pronunciation-piece-1")).toHaveAttribute("data-band","clear");await page.getByTestId("lesson-baseline-continue").click();await advanceLesson(page,"chat");
 await page.getByTestId("lesson-choice-reply-b").click();await page.getByTestId("lesson-chat-record").click();await page.waitForTimeout(1600);await page.getByTestId("lesson-stop").click();
 await expect(page.getByText("Delivered",{exact:true})).toBeVisible();expect(targets).toEqual(["tea","tea","coffee"]);
});
test("mobile chat fits, is accessible, and keeps English out of reply choices",async({page})=>{
 test.setTimeout(60000);await page.setViewportSize({width:390,height:844});await setup(page);await advanceLesson(page,"chat");await expect(page.getByTestId("lesson-choice-reply-b")).not.toContainText("coffee");
 const results=await new AxeBuilder({page}).include("#onboarding-main").withTags(["wcag2a","wcag2aa"]).analyze();expect(results.violations.map(v=>v.id)).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:"/tmp/lingo-template-implementation/mobile-chat.png",fullPage:true});
});
test("pending microphone permission can be cancelled for a complete silent lesson",async({page})=>{
 test.setTimeout(60000);await setup(page);await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>new Promise<MediaStream>(()=>{});});await advanceLesson(page,"baseline");await page.getByTestId("lesson-baseline-record").click();
 await expect(page.getByTestId("lesson-cant-speak")).toBeEnabled();await finishFirstLesson(page);await expect(page.getByRole("heading",{name:/Ready to continue/})).toBeVisible();
});
test("a word mistake is revisited as that word instead of an unrelated sentence",async({page})=>{
 test.setTimeout(60000);const lesson=await setup(page);await advanceLesson(page,"recognize");
 const targetId = await page.getByTestId("lesson-quiz").getAttribute("data-target-id");
 const wrong = lesson.match.find(p => p.id !== targetId)!;
 await page.getByTestId(`quiz-choice-${wrong.id}`).click();await page.getByTestId("lesson-quiz-check").click();await page.getByTestId(`quiz-choice-${targetId}`).click();await page.getByTestId("lesson-quiz-check").click();await page.getByTestId("lesson-quiz-check").click();
 await advanceLesson(page,"revisit");await expect(page.getByTestId("lesson-quiz")).toBeVisible();await expect(page.getByTestId("lesson-quiz")).toContainText(lesson.match.find(p => p.id === targetId)!.hanzi);await finishFirstLesson(page);
});

test("beginners practise two words before the next batch, with real drag, recall and reload", async ({page}) => {
 test.setTimeout(60000);
 const lesson = await setup(page, "heritage");
 await page.getByTestId("lesson-start").click();
 const taught = new Set<string>();
 for (let i = 0; i < Math.min(2, lesson.template!.teaching.length); i++) {
   const word = lesson.template!.teaching[i]; taught.add(word.id);
   await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-lesson-phase", "teach_first");
   await expect(page.getByText(word.hanzi, {exact:true}).first()).toBeVisible();
   await page.getByTestId("lesson-teach-continue").click();
 }
 await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-lesson-phase", "beginner_match");
 await expect(page.locator('[data-testid^="match-tile-"]')).toHaveCount(2);
 await page.reload();
 await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-lesson-phase", "beginner_match");
 for (const id of Array.from(taught)) {
   const transfer = await page.evaluateHandle(() => new DataTransfer());
   await page.getByTestId(`match-tile-${id}`).dispatchEvent("dragstart", {dataTransfer: transfer});
   await page.getByTestId(`match-slot-${id}`).dispatchEvent("drop", {dataTransfer: transfer});
   await transfer.dispose();
 }
 await expect(page.getByTestId("lesson-match-continue")).toBeEnabled();
 await page.getByTestId("lesson-match-continue").click();
 await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-lesson-phase", "beginner_recall");
 const target = await page.getByTestId("lesson-quiz").getAttribute("data-target-id");
 expect(taught.has(target!)).toBe(true);
 await expect(page.locator('[data-testid^="quiz-choice-"]')).toHaveCount(2);
 await page.getByTestId(`quiz-choice-${target}`).click();
 await page.getByTestId("lesson-quiz-check").click();
 await page.getByTestId("lesson-quiz-check").click();
 await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-lesson-phase", lesson.template!.teaching.length > 2 ? "teach_first" : "frame");
 if (lesson.template!.teaching.length > 2) await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-teaching-index", "2");
 await advanceLesson(page, "frame");
 await expect(page.getByTestId("lesson-xp")).toHaveText("10 / 50 XP");
 await finishFirstLesson(page);
});

test("third pronunciation attempt keeps real scores and allows continuation after reload",async({page})=>{
 test.setTimeout(90000);
 let calls=0;
 await page.route("**/api/onboarding/pronunciation",route=>{calls++;return route.fulfill({json:{status:"ok",feedback:"retry",overall:42,tone:40,characters:[{hanzi:"我",pinyin:"wǒ",score:45,targetTone:3},{hanzi:"要",pinyin:"yào",score:40,targetTone:4},{hanzi:"茶",pinyin:"chá",score:42,targetTone:2}]}});});
 await setup(page);await advanceLesson(page,"baseline");
 for(let i=0;i<3;i++){
   await page.getByTestId(i===0?"lesson-baseline-record":"lesson-coach-record").click();
   await page.waitForTimeout(1600);await page.getByTestId("lesson-stop").click();
   await expect(page.getByTestId("pronunciation-results")).toBeVisible();
   await expect(page.getByTestId("pronunciation-results")).not.toContainText(/42|100|80\+|Sentence score/);
   await expect(page.getByTestId("lesson-baseline-continue")).toBeEnabled();
 }
 expect(calls).toBe(3);
 await expect(page.getByText(/Practice complete. You’ve worked/)).toBeVisible();
 await expect(page.getByTestId("lesson-coach-record")).toHaveCount(0);
 await expect(page.locator('[data-band="clear"]')).toHaveCount(0);
 await page.reload();
 await expect(page.getByTestId("pronunciation-piece-0")).toHaveAttribute("data-band","practice");
 await expect(page.getByTestId("lesson-coach-record")).toHaveCount(0);
 await page.getByTestId("lesson-baseline-continue").click();await advanceLesson(page,"chat");
});
test("unavailable pronunciation scores show unassessed sounds and never block continuation",async({page})=>{
 test.setTimeout(60000);
 await page.route("**/api/onboarding/pronunciation",route=>route.fulfill({json:{status:"unavailable"}}));
 await setup(page);await advanceLesson(page,"baseline");await page.getByTestId("lesson-baseline-record").click();
 await page.waitForTimeout(1600);await page.getByTestId("lesson-stop").click();
 await expect(page.getByTestId("pronunciation-piece-0")).toHaveAttribute("data-band","unscored");
 await expect(page.getByTestId("lesson-baseline-continue")).toBeEnabled();
 await page.getByTestId("lesson-baseline-continue").click();await advanceLesson(page,"chat");
});
