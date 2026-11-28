import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createTestingSession, SESSION_COOKIE } from "../../lib/testing/auth";
import { PREVIEW_STORAGE_KEY } from "../../lib/testing/config";
import { miniCoursePreview } from "../../lib/testing/miniCoursePreview";
import { initialState, parseAnswers } from "../../lib/onboarding/personalized/flow";
import { wordsForScreen, type VocabScreenAnswer } from "../../lib/onboarding/personalized/vocabRecognition";
import { updatedLessonLevel } from "../../lib/onboarding/personalized/firstLesson/curriculum";
const env=readFileSync(".env.local","utf8");
const secret=process.env.TESTING_SESSION_SECRET??env.match(/^TESTING_SESSION_SECRET=(.+)$/m)?.[1]?.trim()??"";
async function openPreview(page:Page,state:ReturnType<typeof initialState>){
 test.skip(!secret,"Local testing login is not configured");
 await page.context().addCookies([{name:SESSION_COOKIE,value:createTestingSession(secret),domain:"localhost",path:"/",httpOnly:true,sameSite:"Strict"}]);
 await page.route("**/api/onboarding/progress**",r=>r.fulfill({status:500,json:{error:"Preview stays local"}}));
 await page.addInitScript(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key:PREVIEW_STORAGE_KEY,state});
 await page.goto("/admin/testing");await page.getByRole("button",{name:"Open onboarding flow",exact:true}).click();
}
for(const width of [390,1440])test(`fixed assessment persists 30 words and independent results at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:950});
 const state=initialState(new Date(),"test");state.answers.goal.primary="work";state.answers.interests.keys=["finance"];state.answers.level.selfReport="new";
 for(const step of ["goal","interests","level"] as const)state.events[step]={completed_at:state.updatedAt};
 await openPreview(page,state);
 await expect(page.getByTestId("vocab-grid")).toHaveAttribute("data-count","15");
 await page.getByTestId("vocab-word-assessment-v2-或者").click();
 await page.setViewportSize({width:width===390?1440:390,height:950});
 await expect(page.getByTestId("vocab-word-assessment-v2-或者")).toHaveAttribute("aria-pressed","true");
 await expect(page.getByTestId("vocab-grid")).toHaveAttribute("data-count","15");
 await page.getByTestId("vocab-continue").click();
 await expect(page.getByRole("heading",{name:"What about these more advanced words?"})).toBeVisible();
 await expect(page.getByTestId("vocab-grid")).toHaveAttribute("data-count","15");
 await page.getByTestId("vocab-none-known").click();await page.getByTestId("vocab-continue").click();
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).answers,PREVIEW_STORAGE_KEY);
 const a=parseAnswers(saved);expect(a.estimatedLevel).toBe(1);expect(updatedLessonLevel(a)).toBe(5);
 expect(a.vocabBasic.shownIds.length+a.vocabAdvanced.shownIds.length).toBe(30);
 expect(a.vocabBasic.assessmentVersion).toBe(2);expect(a.vocabAdvanced.assessmentVersion).toBe(2);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width===390?1440:390);
});

test("private preview opens the marker-recommended course even when self-report and HSK estimate differ",async({page})=>{
 const state=miniCoursePreview("few_words","work");
 for(const band of ["basic","advanced"] as const){
  const words=wordsForScreen(band,"work",[],"seed");const selectedIds=words.filter(word=>word.hanzi==="或者").map(word=>word.id);
  const screen:VocabScreenAnswer={assessmentVersion:2,shownIds:words.map(word=>word.id),selectedIds,noneKnown:!selectedIds.length};
  if(band==="basic")state.answers.vocabBasic=screen;else state.answers.vocabAdvanced=screen;
 }
 await openPreview(page,state);
 await expect(page.getByTestId("course-placement")).toHaveAttribute("data-course-tier","5");
 await expect(page.getByTestId("onboarding-step")).toHaveAttribute("data-step","first_lesson");
 await page.getByRole("button",{name:"Testing",exact:true}).click();await page.getByRole("button",{name:"Open onboarding flow",exact:true}).click();
 await expect(page.getByTestId("course-placement")).toHaveAttribute("data-course-tier","5");
});
