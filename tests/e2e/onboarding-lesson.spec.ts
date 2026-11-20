import {beginPlacement,recordWordCheck} from "../../lib/onboarding/personalized/firstLesson/coursePlacement";
import {makeBudgetCourse,type CourseTier} from "../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
import {updatedFirstLesson} from "../../lib/onboarding/personalized/firstLesson/curriculum";
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
 plan.checked=true;
 const tier=({new:1,few_words:2,familiar_topics:5} as const)[level],candidate=makeBudgetCourse(tier,goal),placement=recordWordCheck(beginPlacement(tier,goal),candidate.budget.prerequisiteIds);
 a.firstLesson={...a.firstLesson,coursePlacement:placement,lessonId:candidate.id,vocabularyKnownIds:candidate.budget.prerequisiteIds,vocabularyChecked:true};
 for(const step of stepsFor(a)){if(step==="first_lesson")break;state.events[step]={started_at:state.updatedAt,completed_at:state.updatedAt};}
 await page.addInitScript(({key,state})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));},{key:LOCAL_STORAGE_KEY,state});
 await page.route("**/api/onboarding/first-lesson",route=>route.fulfill({json:{plan}}));
 await page.route("**/api/onboarding/progress**",route=>route.fulfill({json:route.request().method()==="GET"?{account:{kind:"user",firstName:"Test"},progress:null}:{status:"saved",progress:{...route.request().postDataJSON().state,revision:1}}}));
 await page.route("**/api/onboarding/abandon**",route=>route.fulfill({json:{status:"ok"}}));await page.route("**/api/entitlements**",route=>route.fulfill({json:{isPro:false}}));
 await page.goto("/onboarding/journey?resume=first_lesson");await expect(page.getByTestId("lesson-intro")).toBeVisible({timeout:30000});return updatedFirstLesson(a) ?? compileTemplate(plan);
}
for(const goal of ["work","school","heritage","travel","everyday","other"] as const)test(`beginner ${goal}: teaches every planned piece and completes the silent route`,async({page})=>{
 test.setTimeout(60000);const lesson=await setup(page,goal);await page.getByTestId("lesson-start").click();
 await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-lesson-phase","vocabulary");await expect(page.getByTestId("lesson-quiz")).toHaveCount(0);
 expect(lesson.build.chunks.length).toBeGreaterThanOrEqual(2);await finishFirstLesson(page);await expect(page.getByRole("heading",{name:/Ready to continue/})).toBeVisible();
});

test("redesigned familiar-topic route replaces saved templates and preserves progress and XP",async({page})=>{
 test.setTimeout(120000);await setup(page,"everyday","familiar_topics","everyday-5");await advanceLesson(page,"frame");await expect(page.getByTestId("lesson-xp")).toHaveText("10 / 50 XP");
 await page.reload();await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-lesson-phase","frame");await advanceLesson(page);await expect(page.getByTestId("lesson-xp")).toHaveText("50 / 50 XP");
 await page.getByRole("button",{name:"Practice a little more"}).click();await advanceLesson(page);await expect(page.getByTestId("lesson-xp")).toHaveText("50 / 50 XP");
});
test("microphone denial allows the complete silent route",async({page})=>{
 test.setTimeout(60000);await setup(page);await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.reject(new DOMException("Denied","NotAllowedError"));});
 await advanceLesson(page,"baseline");await page.getByTestId("lesson-baseline-record").click();await expect(page.getByRole("status").filter({hasText:/Microphone unavailable/})).toBeVisible();
 await finishFirstLesson(page);await expect(page.getByRole("heading",{name:/Ready to continue/})).toBeVisible();
});

test("mobile chat fits, is accessible, and keeps English out of reply choices",async({page})=>{
 test.setTimeout(60000);await page.setViewportSize({width:390,height:844});const lesson=await setup(page);await advanceLesson(page,"chat");await expect(page.getByTestId(`lesson-choice-${lesson.chat.expectedChoiceId}`)).not.toContainText(lesson.chat.choices[1].meaning);
 const results=await new AxeBuilder({page}).include("#onboarding-main").withTags(["wcag2a","wcag2aa"]).analyze();expect(results.violations.map(v=>v.id)).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:"/tmp/lingo-template-implementation/mobile-chat.png",fullPage:true});
});
test("pending microphone permission can be cancelled for a complete silent lesson",async({page})=>{
 test.setTimeout(60000);await setup(page);await page.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>new Promise<MediaStream>(()=>{});});await advanceLesson(page,"baseline");await page.getByTestId("lesson-baseline-record").click();
 await expect(page.getByTestId("lesson-cant-speak")).toBeEnabled();await finishFirstLesson(page);await expect(page.getByRole("heading",{name:/Ready to continue/})).toBeVisible();
});




test("third pronunciation attempt keeps real scores and allows continuation after reload",async({page})=>{
 test.setTimeout(90000);
 let calls=0;
 const lesson=await setup(page);
 await page.route("**/api/onboarding/pronunciation",route=>{calls++;return route.fulfill({json:{status:"ok",feedback:"retry",overall:42,tone:40,characters:Array.from(lesson.targets[0].hanzi).map((hanzi,i)=>({hanzi,pinyin:["dǎo","yóu","hǎo"][i],score:42,targetTone:[3,2,3][i]}))}});});
 await advanceLesson(page,"baseline");
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
