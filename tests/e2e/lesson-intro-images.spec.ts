import {test,expect} from "@playwright/test";
import {miniCoursePreview} from "../../lib/testing/miniCoursePreview";
import {LOCAL_STORAGE_KEY} from "../../lib/onboarding/personalized/flow";
import {makeBudgetCourse,type CourseTier} from "../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
import {beginPlacement,recordWordCheck,placementFoundationIds} from "../../lib/onboarding/personalized/firstLesson/coursePlacement";
import type {GoalKey} from "../../lib/onboarding/personalized/goals";
const cases=[{goal:"heritage",tier:6,level:"complex_topics"},{goal:"work",tier:4,level:"basic_conversations"},{goal:"school",tier:3,level:"simple_sentences"},{goal:"travel",tier:2,level:"few_words"},{goal:"everyday",tier:5,level:"familiar_topics"},{goal:"other",tier:1,level:"new"}] as const;
for(const item of cases)test(`intro banner: ${item.goal} on mobile and desktop`,async({page},testInfo)=>{
 const state=miniCoursePreview(item.level,item.goal),a=state.answers;
 const lesson=makeBudgetCourse(item.tier,item.goal,0,a),known=placementFoundationIds(lesson);
 a.firstLesson={...a.firstLesson,lessonId:lesson.id,coursePlacement:recordWordCheck(beginPlacement(item.tier,item.goal),known),vocabularyKnownIds:known,vocabularyChecked:true};
 await page.addInitScript(({state,key})=>localStorage.setItem(key,JSON.stringify(state)),{state,key:LOCAL_STORAGE_KEY});
 await page.route("**/flags/**",r=>r.fulfill({json:{featureFlags:{"mini-lesson-onboarding":"test"},featureFlagPayloads:{}}}));
 await page.route("**/api/onboarding/progress**",r=>r.fulfill({json:r.request().method()==="GET"?{account:{kind:"user",firstName:"Test"},progress:null}:{status:"saved",progress:r.request().postDataJSON().state}}));
 await page.route("**/api/onboarding/abandon**",r=>r.fulfill({json:{status:"ok"}}));await page.route("**/api/entitlements**",r=>r.fulfill({json:{isPro:false}}));
 await page.goto("/onboarding/journey?resume=first_lesson",{waitUntil:"domcontentloaded"});
 const banner=page.getByTestId("lesson-intro-image"),image=banner.locator("img");
 await expect(banner).toHaveAttribute("data-goal",item.goal,{timeout:60000});
 for(const width of [390,1280]){
  await page.setViewportSize({width,height:width===390?844:1000});
  await expect(image).toBeVisible();await expect.poll(()=>image.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
  expect(await image.getAttribute("src")).toContain(`${item.goal}-v1.webp`);
  expect(await image.getAttribute("alt")).toBeTruthy();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const bounds=await banner.boundingBox();expect(bounds!.width/bounds!.height).toBeCloseTo(3,1);
  if(item.goal==="heritage")await page.screenshot({path:testInfo.outputPath(`intro-${width}.png`),fullPage:true});
 }
});
