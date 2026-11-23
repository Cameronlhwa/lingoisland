import {test,expect,type Page} from "@playwright/test";
import {initialState,LOCAL_STORAGE_KEY,stepsFor} from "../../lib/onboarding/personalized/flow";
import {makeBudgetCourse} from "../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
import {beginPlacement,recordWordCheck,placementFoundationIds} from "../../lib/onboarding/personalized/firstLesson/coursePlacement";
async function setup(page:Page){
 const state=initialState(new Date(),"test"),a=state.answers;
 a.goal.primary="heritage";a.level.selfReport="basic_conversations";a.interests.keys=["food"];a.experience.key="under_6_months";
 a.vocabBasic={shownIds:["wo","ni"],selectedIds:[],noneKnown:true};a.vocabAdvanced={shownIds:[],selectedIds:[],noneKnown:false,skipped:true};
 a.usingPain={keys:["want_to_improve"],timing:"ongoing",upcomingText:null};a.learningPain={keys:["not_relevant"],hesitations:["dont_know_where_start"]};a.availability={minutes:"10",days:"3",session:null};
 const lesson=makeBudgetCourse(4,"heritage",0,a),known=placementFoundationIds(lesson),placement=recordWordCheck(beginPlacement(4,"heritage"),known);
 a.firstLesson={...a.firstLesson,lessonId:lesson.id,coursePlacement:placement,vocabularyKnownIds:known,vocabularyChecked:true,phase:"frame",grammarStepId:"practice:3",xpAwarded:["meaning"]};
 for(const step of stepsFor(a)){if(step==="first_lesson")break;state.events[step]={completed_at:state.updatedAt};}
 await page.addInitScript(({state,key})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));},{state,key:LOCAL_STORAGE_KEY});
 await page.route("**/flags/**",r=>r.fulfill({json:{featureFlags:{"mini-lesson-onboarding":"test"},featureFlagPayloads:{}}}));
 await page.route("**/api/onboarding/progress**",r=>r.fulfill({json:r.request().method()==="GET"?{account:{kind:"user",firstName:"Test"},progress:null}:{status:"saved",progress:r.request().postDataJSON().state}}));
 await page.route("**/api/onboarding/abandon**",r=>r.fulfill({json:{status:"ok"}}));await page.route("**/api/entitlements**",r=>r.fulfill({json:{isPro:false}}));
 await page.goto("/onboarding/journey?resume=first_lesson",{waitUntil:"domcontentloaded"});await expect(page.getByTestId("writing-answer")).toBeVisible({timeout:60000});
}
test("accepts alternative wording without showing the model answer or a hint",async({page})=>{
 let sent:any;
 await page.route("**/api/onboarding/writing",r=>{sent=r.request().postDataJSON();return r.fulfill({json:{status:"correct",feedback:"Your sentence naturally states two alternatives."}});});
 await setup(page);await expect(page.getByTestId("writing-hint")).toHaveCount(0);
 await page.getByTestId("writing-answer").fill("我想吃饺子或者面条");await page.getByTestId("writing-check").click();
 await expect(page.getByTestId("writing-check")).toHaveText("Continue");
 expect(sent.answer).toBe("我想吃饺子或者面条");expect(sent.stepId).toBe("practice:3");
 await expect(page.getByTestId("writing-hint")).toHaveCount(0);await expect(page.getByText("One possible answer")).toHaveCount(0);
 await page.getByTestId("writing-check").click();await expect(page.getByTestId("lesson-reading")).toBeVisible();
});
test("shows a hint only after an incorrect grade, then accepts a revision",async({page})=>{
 let count=0;
 await page.route("**/api/onboarding/writing",r=>r.fulfill({json:++count===1?{status:"retry",feedback:"Use 或者 in a statement of alternatives."}:{status:"correct",feedback:"That works."}}));
 await setup(page);await expect(page.getByTestId("writing-hint")).toHaveCount(0);
 await page.getByTestId("writing-answer").fill("我想吃饺子还是面条");await page.getByTestId("writing-check").click();
 await expect(page.getByTestId("writing-hint")).toBeVisible();await expect(page.getByTestId("writing-check")).toHaveText("Check my answer");
 await page.getByTestId("writing-answer").fill("我想吃面条或者饺子。");await page.getByTestId("writing-check").click();
 await expect(page.getByTestId("writing-check")).toHaveText("Continue");await expect(page.getByTestId("writing-hint")).toHaveCount(0);
});
test("a grading outage offers retry without showing a hint or calling the answer wrong",async({page})=>{
 await page.route("**/api/onboarding/writing",r=>r.fulfill({status:503,json:{status:"unavailable",feedback:"Unavailable"}}));
 await setup(page);await page.getByTestId("writing-answer").fill("我想吃饺子或者面条");await page.getByTestId("writing-check").click();
 await expect(page.getByTestId("writing-check")).toHaveText("Try again");await expect(page.getByTestId("writing-hint")).toHaveCount(0);
});
