import {test,expect,type Page} from "@playwright/test";
import {readFileSync} from "node:fs";
import {createTestingSession,SESSION_COOKIE} from "../../lib/testing/auth";
import {previewStorageKey} from "../../lib/testing/config";
import {miniCoursePreview} from "../../lib/testing/miniCoursePreview";
import {advanceLesson} from "./helpers/firstLesson";
const env=readFileSync(".env.local","utf8");
const secret=process.env.TESTING_SESSION_SECRET??env.match(/^TESTING_SESSION_SECRET=(.+)$/m)?.[1]?.trim()??"";
async function admin(page:Page){
 test.skip(!secret,"Testing login is not configured");
 await page.context().addCookies([{name:SESSION_COOKIE,value:createTestingSession(secret),domain:"localhost",path:"/",httpOnly:true,sameSite:"Strict"}]);
 await page.route("**/api/onboarding/progress**",r=>r.fulfill({status:500,json:{error:"Private preview must stay local"}}));
 await page.goto("/admin/testing");
}
for(const width of [390,1440])test(`likes test lesson completes both turns and the short question at ${width}px`,async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width,height:950});await admin(page);
 await page.getByTestId("mini-course-goal").selectOption("everyday");
 await page.getByTestId("preview-course-new-test").click();
 await expect(page.getByTestId("course-placement")).toHaveAttribute("data-course-tier","1");
 await expect(page.getByTestId("known-word-喜欢")).toBeVisible();
 await advanceLesson(page,"frame");
 await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-lesson-id","likes-v1-1-everyday-0");
 // Step through the statement check and the question teaching to the dedicated ma page.
 await page.getByTestId("grammar-continue").click();
 await page.getByTestId("grammar-option-我喜欢电影。").click();await page.getByTestId("grammar-check").click();await page.getByTestId("grammar-check").click();
 await expect(page.getByTestId("grammar-practice")).toHaveAttribute("data-grammar-step","likes-question:teach");
 await page.getByTestId("grammar-continue").click();
 await expect(page.getByRole("heading",{name:"What does 吗 do?"})).toBeVisible();
 await expect(page.getByTestId("teaching-explanation")).toContainText("question particle");
 await expect(page.getByTestId("teaching-example-3")).toBeVisible();
 await page.screenshot({path:`/private/tmp/likes-ma-${width}.png`,fullPage:true});
 await advanceLesson(page,"follow_up");
 await expect(page.getByTestId("chat-situation-goal")).toHaveText("Ask whether Huahua likes movies.");
 const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).answers.firstLesson,previewStorageKey("test"));
 expect(before.selectedDrinkId).toBe("我喜欢音乐。");
 await page.reload();await page.getByRole("button",{name:"Open onboarding flow",exact:true}).click();
 await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-lesson-phase","follow_up");
 await advanceLesson(page,"short_question");
 await expect(page.getByRole("heading",{name:"When the meaning is already clear"})).toBeVisible();
 await expect(page.getByTestId("teaching-example-1")).toContainText("喜欢吗？");
 await page.getByTestId("grammar-continue").click();
 await page.reload();await page.getByRole("button",{name:"Open onboarding flow",exact:true}).click();
 await expect(page.getByTestId("grammar-practice")).toHaveAttribute("data-grammar-step","likes-short-question:check");
 await advanceLesson(page,"complete");
 await expect(page.getByTestId("lesson-follow-up-recap")).toContainText("你喜欢电影吗？");
 await expect(page.getByRole("progressbar",{name:"Lesson progress"})).toHaveAttribute("aria-valuenow","100");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).answers,previewStorageKey("test"));
 expect(saved.firstLevelVariant).toBe("test");expect(saved.firstLesson.shortQuestionComplete).toBe(true);expect(saved.firstLesson.followUpReplyId).toBe("你喜欢电影吗？");expect(saved.firstLesson.completedAt).toBeTruthy();
});

test("admin offers both beginner variants and switching cannot carry progress across",async({page})=>{
 await admin(page);await expect(page.getByTestId("preview-course-new")).toBeVisible();await expect(page.getByTestId("preview-course-new-test")).toBeVisible();
 await page.getByTestId("preview-course-new").click();await advanceLesson(page,"intro");
 await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-lesson-id",/^budget-v1-1/);
 await page.getByRole("button",{name:"Testing",exact:true}).click();
 await page.getByTestId("preview-course-new-test").click();await advanceLesson(page,"intro");
 await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-lesson-id",/^likes-v1-1/);
 const saved=await page.evaluate(keys=>keys.map(key=>JSON.parse(localStorage.getItem(key)!).answers),[previewStorageKey("control"),previewStorageKey("test")]);
 expect(saved[0].firstLevelVariant).toBe("control");expect(saved[1].firstLevelVariant).toBe("test");expect(saved[0].firstLesson.lessonId).not.toBe(saved[1].firstLesson.lessonId);
 await page.getByRole("button",{name:"Testing",exact:true}).click();await page.getByTestId("beginner-variant").selectOption("control");await page.getByRole("button",{name:"Open onboarding flow",exact:true}).click();
 await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-lesson-id",/^budget-v1-1/);
});

for(const first of ["control","test"] as const)test(`public PostHog first-level-test=${first} selects the right lesson and locks across refresh`,async({page})=>{
 await page.route(/posthog\.com/,r=>r.abort());
 let flag:"control"|"test"=first;
 await page.route("**/flags/**",r=>r.fulfill({json:{featureFlags:{"mini-lesson-onboarding":"test","first-level-test":flag},featureFlagPayloads:{}}}));
 await page.route("**/api/onboarding/progress**",r=>r.fulfill({json:r.request().method()==="GET"?{account:{kind:"guest"},progress:null}:{status:"saved"}}));
 await page.route("**/api/entitlements**",r=>r.fulfill({json:{isPro:false}}));
 const state=miniCoursePreview("new","everyday");delete state.answers.firstLevelVariant;
 await page.addInitScript(state=>{if(!localStorage.getItem("lingo_onboarding_v2"))localStorage.setItem("lingo_onboarding_v2",JSON.stringify(state));window.__lingoAnalyticsSpy=true;},state);
 await page.goto("/onboarding/journey");await advanceLesson(page,"intro");
 await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-lesson-id",first==="test"?/^likes-v1-1/:/^budget-v1-1/);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("lingo_onboarding_v2")!).answers);expect(saved.firstLevelVariant).toBe(first);
 const events=await page.evaluate(()=>window.__lingoAnalyticsEvents??[]);
 expect(events.some(e=>e.event==="onboarding_first_level_assigned"&&e.properties.first_level_variant===first&&e.properties["$feature/first-level-test"]===first)).toBe(true);
 flag=first==="test"?"control":"test";await page.reload();
 await expect(page.getByTestId("first-lesson")).toHaveAttribute("data-lesson-id",first==="test"?/^likes-v1-1/:/^budget-v1-1/);
});
