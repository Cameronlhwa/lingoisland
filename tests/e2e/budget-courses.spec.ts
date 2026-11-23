import { test, expect, type Page } from "@playwright/test";
import { initialState, LOCAL_STORAGE_KEY, stepsFor } from "../../lib/onboarding/personalized/flow";
import { makeBudgetCourse, type CourseTier } from "../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
import { updatedFirstLesson } from "../../lib/onboarding/personalized/firstLesson/curriculum";
import { advanceLesson } from "./helpers/firstLesson";
import type { SelfReportKey } from "../../lib/onboarding/personalized/levels";
import {courseNewItemLimit,placementFoundationIds,placementTargetIds} from "../../lib/onboarding/personalized/firstLesson/coursePlacement";
import AxeBuilder from "@axe-core/playwright";
const levels:SelfReportKey[]=["new","few_words","simple_sentences","basic_conversations","familiar_topics","complex_topics"];
async function setup(page:Page,tier:CourseTier){
 const state=initialState(new Date(),"test"),a=state.answers;
 a.goal.primary="heritage";a.level.selfReport=levels[tier-1];a.interests.keys=["food"];a.experience.key=tier===1?"not_started":"under_6_months";
 a.vocabBasic={shownIds:["wo","ni"],selectedIds:[],noneKnown:true};a.vocabAdvanced={shownIds:[],selectedIds:[],noneKnown:false,skipped:true};
 a.usingPain={keys:["want_to_improve"],timing:"ongoing",upcomingText:null};a.learningPain={keys:["not_relevant"],hesitations:["dont_know_where_start"]};a.availability={minutes:"5",days:"3",session:null};
 for(const step of stepsFor(a)){if(step==="first_lesson")break;state.events[step]={completed_at:state.updatedAt};}
 await page.addInitScript(({state,key})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));},{state,key:LOCAL_STORAGE_KEY});
 await page.route("**/api/onboarding/writing",r=>r.fulfill({json:{status:"correct",feedback:"Your answer meets the task."}}));
 await page.route("**/flags/**",r=>r.fulfill({json:{featureFlags:{"mini-lesson-onboarding":"test"},featureFlagPayloads:{}}}));
 await page.route("**/api/onboarding/progress**",r=>r.fulfill({json:r.request().method()==="GET"?{account:{kind:"user",firstName:"Test"},progress:null}:{status:"saved",progress:r.request().postDataJSON().state}}));
 await page.route("**/api/onboarding/abandon**",r=>r.fulfill({json:{status:"ok"}}));await page.route("**/api/entitlements**",r=>r.fulfill({json:{isPro:false}}));
 await page.goto("/onboarding/journey?resume=first_lesson",{waitUntil:"domcontentloaded"});await expect(page.getByTestId("course-placement")).toBeVisible({timeout:60000});
}
for(const tier of [1,2,3,4,5,6] as CourseTier[])test(`budget course ${tier} keeps its level when supporting words are known and completes to 50 XP`,async({page})=>{
 test.setTimeout(120000);await page.setViewportSize({width:390,height:844});const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 await setup(page,tier);const candidate=makeBudgetCourse(tier,"heritage");
 const known=placementFoundationIds(candidate);
 for(const id of known)await page.getByTestId(`known-word-${id}`).click();
 await page.getByTestId("course-placement-continue").click();await expect(page.getByTestId("lesson-intro")).toBeVisible();
 await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-lesson-id",candidate.id);
 const progress=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).answers.firstLesson,LOCAL_STORAGE_KEY);
 const unfamiliar=candidate.match.filter(w=>!progress.vocabularyKnownIds.includes(w.id));expect(progress.coursePlacement.tier).toBe(tier);
 for(const word of candidate.match)if(!progress.coursePlacement.checkedIds.includes(word.id))expect(progress.coursePlacement.evidence[word.id]).toBeUndefined();
 await page.reload();await expect(page.getByTestId("lesson-intro")).toBeVisible();await advanceLesson(page,"frame");
 await expect(page.locator("textarea")).toHaveCount(0);
 if(tier===4){await page.screenshot({path:"/tmp/lingo-budget-course-mobile.png",fullPage:true});await page.setViewportSize({width:1280,height:900});await page.screenshot({path:"/tmp/lingo-budget-course-desktop.png",fullPage:true});await page.setViewportSize({width:390,height:844});}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await advanceLesson(page,"complete");await expect(page.getByTestId("lesson-xp")).toHaveText("50 / 50 XP");
 expect((await new AxeBuilder({page}).include("#onboarding-main").withTags(["wcag2a","wcag2aa"]).analyze()).violations.map(v=>v.id)).toEqual([]);expect(errors).toEqual([]);
});
test("three sampled targets and foundational gaps decide placement independently",async({page})=>{
 await setup(page,4);const course=makeBudgetCourse(4,"heritage");
 await expect(page.locator('[data-testid^="known-word-"]')).toHaveCount(9);
 for(const id of course.budget.topicIds)await expect(page.getByTestId(`known-word-${id}`)).toHaveCount(0);
 for(const id of placementFoundationIds(course))await page.getByTestId(`known-word-${id}`).click();
 await page.getByTestId("course-placement-continue").click();
 await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-lesson-id",course.id);
});
test("known sample opens grammar checks immediately; passing advances one level",async({page})=>{
 await setup(page,4);await page.getByTestId("vocabulary-know-all").click();await page.getByTestId("course-placement-continue").click();
 await expect(page.getByTestId("course-grammar-probe")).toBeVisible();
 const course=makeBudgetCourse(4,"heritage");
 for(const q of course.budget.probes){await page.getByTestId(`probe-option-${q.correct}`).click();await page.getByTestId("course-probe-continue").click();}
 await expect(page.getByTestId("course-placement")).toHaveAttribute("data-course-tier","5");
 for(const id of ["我","我们","也","因为","什么","自己"]){if(placementFoundationIds(course).includes(id))await expect(page.getByTestId(`known-word-${id}`)).toHaveCount(0);}
 await page.reload();await expect(page.getByTestId("course-placement")).toHaveAttribute("data-course-tier","5");
});
test("missing most foundations checks only unseen words one level down",async({page})=>{
 await setup(page,4);const course=makeBudgetCourse(4,"heritage");
 for(const id of placementTargetIds(course))await page.getByTestId(`known-word-${id}`).click();
 await page.getByTestId("course-placement-continue").click();
 await expect(page.getByTestId("course-placement")).toHaveAttribute("data-course-tier","3");
 await expect(page.getByTestId("known-word-能")).toBeVisible();
 const p=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).answers.firstLesson.coursePlacement,LOCAL_STORAGE_KEY);
 for(const id of placementFoundationIds(course))expect(p.evidence[id]).toBe(false);
 await page.reload();await expect(page.getByTestId("course-placement")).toHaveAttribute("data-course-tier","3");
});
