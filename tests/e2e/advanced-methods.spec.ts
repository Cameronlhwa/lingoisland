import {test,expect} from "@playwright/test";
import {initialState,LOCAL_STORAGE_KEY,stepsFor} from "../../lib/onboarding/personalized/flow";
import {makeBudgetCourse} from "../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
import {beginPlacement,recordWordCheck,placementFoundationIds} from "../../lib/onboarding/personalized/firstLesson/coursePlacement";
import {grammarSteps} from "../../lib/onboarding/personalized/firstLesson/grammarSequence";
import {advanceLesson} from "./helpers/firstLesson";
for(const tier of [4,5,6] as const)test(`level ${tier}: required writing, reading and conversation finish at 50 XP`,async({page})=>{
 test.setTimeout(180000);
 await page.setViewportSize({width:390,height:844});
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
 const state=initialState(new Date(),"test"),a=state.answers;
 a.goal.primary="heritage";a.level.selfReport=({4:"basic_conversations",5:"familiar_topics",6:"complex_topics"} as const)[tier];a.interests.keys=["food"];a.experience.key="under_6_months";
 a.vocabBasic={shownIds:["wo","ni"],selectedIds:[],noneKnown:true};a.vocabAdvanced={shownIds:[],selectedIds:[],noneKnown:false,skipped:true};
 a.usingPain={keys:["want_to_improve"],timing:"ongoing",upcomingText:null};a.learningPain={keys:["not_relevant"],hesitations:["dont_know_where_start"]};a.availability={minutes:"10",days:"3",session:null};
 const lesson=makeBudgetCourse(tier,"heritage",0,a);
 const known=placementFoundationIds(lesson);
 const placement=recordWordCheck(beginPlacement(tier,"heritage"),known);expect(placement.status).toBe("ready");
 a.firstLesson={...a.firstLesson,lessonId:lesson.id,coursePlacement:placement,vocabularyKnownIds:known,vocabularyChecked:true,phase:"frame",xpAwarded:["meaning"]};
 for(const step of stepsFor(a)){if(step==="first_lesson")break;state.events[step]={completed_at:state.updatedAt};}
 await page.addInitScript(({state,key})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));},{state,key:LOCAL_STORAGE_KEY});
 await page.route("**/api/onboarding/writing",r=>r.fulfill({json:{status:"correct",feedback:"Your answer meets the task."}}));
 await page.route("**/flags/**",r=>r.fulfill({json:{featureFlags:{"mini-lesson-onboarding":"test"},featureFlagPayloads:{}}}));
 await page.route("**/api/onboarding/progress**",r=>r.fulfill({json:r.request().method()==="GET"?{account:{kind:"user",firstName:"Test"},progress:null}:{status:"saved",progress:r.request().postDataJSON().state}}));
 await page.route("**/api/onboarding/abandon**",r=>r.fulfill({json:{status:"ok"}}));await page.route("**/api/entitlements**",r=>r.fulfill({json:{isPro:false}}));
 await page.goto("/onboarding/journey?resume=first_lesson",{waitUntil:"domcontentloaded"});
 await expect(page.getByTestId("grammar-practice")).toBeVisible({timeout:60000});
 let written=0,read=0,comprehension=0;
 for(const step of grammarSteps(lesson.curriculum!)){
  await expect(page.getByTestId("grammar-practice")).toHaveAttribute("data-grammar-step",step.id);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  if(step.kind==="teach"){await page.getByTestId("grammar-continue").click();continue;}
  const p=step.practice;
  if(p.kind==="writing"){
   written++;await expect(page.getByTestId("writing-answer")).toBeVisible();await page.getByTestId("writing-answer").fill(p.sample.hanzi);
   if(written===1){await page.reload();await expect(page.getByTestId("writing-answer")).toHaveValue(p.sample.hanzi);}
   await page.getByTestId("writing-check").click();await page.getByTestId("writing-check").click();
  }else if(p.kind==="reading"){
   read++;await expect(page.getByTestId("reading-text")).toHaveText(p.reading.text);await page.getByTestId("reading-continue").click();
  }else if(p.kind==="choice"){
   comprehension++;await page.getByTestId(`grammar-option-${p.correct}`).click();await page.getByTestId("grammar-check").click();await page.getByTestId("grammar-check").click();
  }else throw Error("Unexpected sentence-ordering exercise");
 }
 expect(written).toBe(tier===6?2:4);expect(read).toBe(1);expect(comprehension).toBe(tier===4?3:tier===5?2:1);
 if(tier===6){await advanceLesson(page,"discussion");await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-lesson-phase","discussion");}
 await advanceLesson(page,"complete");await expect(page.getByTestId("lesson-xp")).toHaveText("50 / 50 XP");expect(errors).toEqual([]);
});
