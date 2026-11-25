import {test,expect,type Page} from "@playwright/test";
import {mkdirSync,writeFileSync,rmSync} from "node:fs";
import {makeBudgetCourse,type CourseTier} from "../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
import {placementFoundationIds,placementTargetIds} from "../../lib/onboarding/personalized/firstLesson/coursePlacement";
const path="app/course-placement-browser-test";
test.describe.configure({mode:"serial"});
test.beforeAll(()=>{mkdirSync(path,{recursive:true});writeFileSync(`${path}/page.tsx`,'export {default} from "@/tests/e2e/helpers/CoursePlacementHarness";');});
test.afterAll(()=>{rmSync(path,{recursive:true,force:true});rmSync(".next/types/app/course-placement-browser-test",{recursive:true,force:true});});
async function setup(page:Page,tier:number){
 await page.setViewportSize({width:390,height:844});
 await page.route("**/api/profile",r=>r.fulfill({json:{}}));
 await page.addInitScript(()=>Object.defineProperty(window,"speechSynthesis",{configurable:true,value:{speak(){},cancel(){}}}));
 await page.goto(`/course-placement-browser-test?tier=${tier}`);
 await expect(page.getByTestId("course-placement")).toHaveAttribute("data-course-tier",String(tier));
}
async function probe(page:Page,tier:CourseTier,pass=true){
 for(const q of makeBudgetCourse(tier,"heritage").budget.probes){
  const id=pass?q.correct:q.choices.find(c=>c.id!==q.correct)!.id;
  await page.getByTestId(`probe-option-${id}`).click();await page.getByTestId("course-probe-continue").click();
 }
}
for(const tier of [1,2,3,4,5,6] as CourseTier[])test(`level ${tier}: familiar words promote after a successful grammar check`,async({page})=>{
 await setup(page,tier);await page.getByTestId("vocabulary-know-all").click();await page.getByTestId("course-placement-continue").click();
 await expect(page.getByTestId("course-grammar-probe")).toBeVisible();
 await probe(page,tier);
 if(tier<6){await expect(page.getByTestId("course-placement")).toHaveAttribute("data-course-tier",String(tier+1));await page.reload();await expect(page.getByTestId("course-placement")).toHaveAttribute("data-course-tier",String(tier+1));}
 else await expect(page.getByTestId("lesson-intro")).toBeVisible();
});
for(const tier of [2,3,4,5,6] as CourseTier[])test(`level ${tier}: missing foundations moves down and survives reload`,async({page})=>{
 await setup(page,tier);await page.getByTestId("vocabulary-know-none").click();await page.getByTestId("course-placement-continue").click();
 await expect(page.getByTestId("course-placement")).toHaveAttribute("data-course-tier",String(tier-1));
 await page.reload();await expect(page.getByTestId("course-placement")).toHaveAttribute("data-course-tier",String(tier-1));
});
test("known words are skipped even when grammar needs practice",async({page})=>{
 await setup(page,2);const course=makeBudgetCourse(2,"heritage");
 await page.getByTestId("vocabulary-know-all").click();await page.getByTestId("course-placement-continue").click();await probe(page,2,false);
 await expect(page.getByTestId("lesson-intro")).toBeVisible();await page.reload();await page.getByTestId("lesson-start").click();
 const known=[...placementFoundationIds(course),...placementTargetIds(course)];
 const progress=await page.evaluate(()=>JSON.parse(localStorage.getItem("placement-fixture")!).answers.firstLesson);
 expect(progress.vocabularyKnownIds).toEqual(expect.arrayContaining(known));
 await expect(page.getByTestId("lesson-vocabulary")).toHaveAttribute("data-vocabulary-step","teach");
 await expect(page.getByTestId("lesson-vocabulary")).not.toContainText("Word 1 of 3");
});
test("resuming a replacement course retains its known vocabulary",async({page})=>{
 const {beginPlacement,recordWordCheck,finishGrammarProbe,placementAssessmentWords}=await import("../../lib/onboarding/personalized/firstLesson/coursePlacement");
 const {initialState}=await import("../../lib/onboarding/personalized/flow");
 const state=initialState(new Date(),"test"),course=makeBudgetCourse(2,"heritage");
 const p=finishGrammarProbe(recordWordCheck(beginPlacement(2,"heritage"),placementAssessmentWords(course).map(w=>w.id)),false);
 state.answers.firstLesson={...state.answers.firstLesson,lessonId:"older-lesson",coursePlacement:p};
 await page.addInitScript(state=>localStorage.setItem("placement-fixture",JSON.stringify(state)),state);
 await page.route("**/api/profile",r=>r.fulfill({json:{}}));
 await page.goto("/course-placement-browser-test?tier=2");
 await expect(page.getByTestId("lesson-intro")).toBeVisible();
 await page.getByTestId("lesson-start").click();
 await expect(page.getByTestId("lesson-vocabulary")).toHaveAttribute("data-vocabulary-step","teach");
 const vocab=page.getByTestId("lesson-vocabulary");
 await expect(vocab).not.toContainText("Word 1 of 3");
});
test("a failed higher vocabulary check does not return a learner to a mastered course",async({page})=>{
 await setup(page,4);await page.getByTestId("vocabulary-know-all").click();await page.getByTestId("course-placement-continue").click();await probe(page,4);
 await page.getByTestId("vocabulary-know-none").click();await page.getByTestId("course-placement-continue").click();
 await expect(page.getByTestId("lesson-intro")).toBeVisible();
 const progress=await page.evaluate(()=>JSON.parse(localStorage.getItem("placement-fixture")!).answers.firstLesson);
 expect(progress.coursePlacement.tier).toBe(5);
});
