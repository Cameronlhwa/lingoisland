import {test,expect,type Page} from "@playwright/test";
import {initialState,LOCAL_STORAGE_KEY,stepsFor} from "../../lib/onboarding/personalized/flow";
import {mockMiniLessonFlag} from "./helpers/onboardingExperiment";
async function setup(page:Page,flag:unknown="control"){
 await page.route(/posthog\.com/,route=>route.abort());
 await mockMiniLessonFlag(page,flag);
 await page.route("**/api/onboarding/progress**",route=>route.fulfill({json:route.request().method()==="GET"?{account:{kind:"guest"},progress:null}:{status:"saved",progress:route.request().postDataJSON().state}}));
 await page.route("**/api/onboarding/abandon**",route=>route.fulfill({json:{status:"ok"}}));
 await page.route("**/api/entitlements**",route=>route.fulfill({json:{isPro:false}}));
 await page.addInitScript(()=>{window.__lingoAnalyticsSpy=true;});
}
async function toLevel(page:Page){
 await page.goto("/onboarding/journey");
 await page.getByTestId("goal-work").click();await page.getByTestId("continue").click();
 await page.getByTestId("interest-meetings").click();await page.getByTestId("continue").click();
 await page.getByTestId("level-few_words").click();await page.getByTestId("continue").click();
}
for(const flag of ["control",false,true,"missing","unexpected"])test(`flag ${flag}: production is default`,async({page})=>{
 await setup(page,flag);await toLevel(page);
 await expect(page.getByTestId("onboarding-step")).toHaveAttribute("data-step","experience");
 await expect(page.getByTestId("onboarding-step")).toHaveAttribute("data-onboarding-variant","control");
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem("lingo_onboarding_v2")!));
 expect(saved.answers.onboardingVariant).toBe("control");
 const events=await page.evaluate(()=>window.__lingoAnalyticsEvents);expect(events?.some(e=>e.properties.onboarding_variant==="control")).toBe(true);
});
test("test selects vocabulary screens and a refreshed page obeys the current flag",async({page})=>{
 await setup(page,"test");await toLevel(page);
 await expect(page.getByTestId("onboarding-step")).toHaveAttribute("data-step","vocab_basic");
 await expect(page.getByTestId("onboarding-step")).toHaveAttribute("data-onboarding-variant","test");
 await mockMiniLessonFlag(page,"control");
 // A refresh must obey the current flag, even if test progress is retained.
 await page.reload();
 await expect(page.getByTestId("onboarding-step")).toHaveAttribute("data-onboarding-variant","control");
 await expect(page.getByTestId("onboarding-step")).toHaveAttribute("data-step","experience");
});
test("blocked flags use control without hanging onboarding",async({page})=>{
 await setup(page);await page.route("**/flags/**",route=>route.abort());
 await page.goto("/onboarding/journey");
 await expect(page.getByTestId("onboarding-step")).toHaveAttribute("data-onboarding-variant","control",{timeout:10000});
});
test("control preserves the production pronunciation and commitment screens and skips the lesson",async({page})=>{
 await setup(page,"control");
 const state=initialState(new Date(),"test"),a=state.answers;
 a.goal.primary="work";a.interests.keys=["meetings"];a.level.selfReport="new";
 a.usingPain={keys:["want_to_improve"],timing:"ongoing",upcomingText:null};a.learningPain={keys:[],hesitations:["dont_know_where_start"]};
 a.availability={minutes:"10",days:"5",session:null};
 for(const step of ["goal","interests","level","using_pain","learning_pain","reviews"] as const)state.events[step]={completed_at:state.updatedAt};
 await page.addInitScript(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key:LOCAL_STORAGE_KEY,state});
 await page.goto("/onboarding/journey?resume=first_lesson");
 await expect(page.getByRole("heading",{name:"Say your first word in Mandarin"})).toBeVisible();
 await page.getByTestId("pronunciation-skip").click();
 await expect(page.getByTestId("reflect-confirm").filter({visible:true})).toBeVisible({timeout:20000});
 await expect(page.getByTestId("reflect-confirm").filter({visible:true})).toHaveText("I’m ready to get there");
 await page.getByTestId("reflect-confirm").filter({visible:true}).click();
 await expect(page.getByRole("heading",{name:"Ready to begin your Mandarin journey?"})).toBeVisible();
 await expect(page.getByTestId("first-lesson")).toHaveCount(0);
});

test("late test response cannot switch an already opened control questionnaire",async({page})=>{
 await setup(page);
 let delivered=false;
 await page.route("**/flags/**",async route=>{await new Promise(resolve=>setTimeout(resolve,2700));try{await route.fulfill({json:{featureFlags:{"mini-lesson-onboarding":"test"},featureFlagPayloads:{}}});}finally{delivered=true;}});
 await page.goto("/onboarding/journey");
 await expect(page.getByTestId("onboarding-step")).toHaveAttribute("data-onboarding-variant","control",{timeout:10000});
 await expect.poll(()=>delivered,{timeout:10000}).toBe(true);
 await page.getByTestId("goal-work").click();await page.getByTestId("continue").click();
 await expect(page.getByTestId("onboarding-step")).toHaveAttribute("data-onboarding-variant","control");
});
