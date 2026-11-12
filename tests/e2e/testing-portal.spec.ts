import {test,expect,type Page} from "@playwright/test";
import {readFileSync} from "node:fs";
import {createTestingSession,SESSION_COOKIE} from "../../lib/testing/auth";
import {PREVIEW_STORAGE_KEY} from "../../lib/testing/config";
import {initialState,LOCAL_STORAGE_KEY} from "../../lib/onboarding/personalized/flow";
import {finishFirstLesson} from "./helpers/firstLesson";
const env=readFileSync(".env.local","utf8");
const secret=process.env.TESTING_SESSION_SECRET??env.match(/^TESTING_SESSION_SECRET=(.+)$/m)?.[1]?.trim()??"";
async function authorised(page:Page){test.skip(!secret,"Local testing login is not configured");await page.context().addCookies([{name:SESSION_COOKIE,value:createTestingSession(secret),domain:"localhost",path:"/",httpOnly:true,sameSite:"Strict"}]);}
test("private testing requires password sign-in and has no Google sign-in",async({page})=>{
 await page.goto("/admin/testing");await expect(page.getByRole("heading",{name:"LingoIsland testing"})).toBeVisible();await expect(page.getByLabel("Email")).toHaveValue("ourlingoisland@gmail.com");await expect(page.getByLabel("Password")).toHaveAttribute("type","password");await expect(page.getByText(/Google/)).toHaveCount(0);await expect(page.getByRole("button",{name:"Open onboarding flow"})).toHaveCount(0);
});
test("real password endpoint creates a secure cookie and sign out revokes access",async({page})=>{
 test.skip(!process.env.TESTING_E2E_PASSWORD,"Set TESTING_E2E_PASSWORD to verify the local login");
 await page.goto("/admin/testing");await page.getByLabel("Password").fill(process.env.TESTING_E2E_PASSWORD!);await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page.getByRole("heading",{name:"What would you like to test?"})).toBeVisible();
 const cookie=(await page.context().cookies()).find(c=>c.name===SESSION_COOKIE)!;expect(cookie.httpOnly).toBe(true);expect(cookie.sameSite).toBe("Strict");
 await page.getByRole("button",{name:"Sign out",exact:true}).click();await expect(page.getByRole("heading",{name:"LingoIsland testing"})).toBeVisible();
});
test("preview forces test, isolates progress, and resets repeatedly without production writes",async({page})=>{
 await authorised(page);let writes=0;
 await page.route("**/api/onboarding/progress**",route=>{writes++;return route.fulfill({json:{error:"Preview must not use production progress"},status:500});});
 await page.route("**/flags/**",route=>route.fulfill({json:{featureFlags:{"mini-lesson-onboarding":"control"}}}));
 await page.addInitScript(({key})=>{localStorage.setItem(key,JSON.stringify({sentinel:"normal progress"}));window.__lingoAnalyticsSpy=true;},{key:LOCAL_STORAGE_KEY});
 await page.goto("/admin/testing");await page.getByRole("button",{name:"Open onboarding flow"}).click();await expect(page.getByTestId("onboarding-step")).toHaveAttribute("data-onboarding-variant","test");
 await page.getByTestId("goal-work").click();await page.getByTestId("continue").click();await page.getByTestId("interest-meetings").click();await page.getByTestId("continue").click();await page.getByTestId("level-new").click();await page.getByTestId("continue").click();await expect(page.getByTestId("onboarding-step")).toHaveAttribute("data-step","vocab_basic");
 for(let i=0;i<2;i++){await page.getByRole("button",{name:"Reset test run"}).click();await expect(page.getByTestId("onboarding-step")).toHaveAttribute("data-step","goal");}
 expect(await page.evaluate(key=>localStorage.getItem(key),LOCAL_STORAGE_KEY)).toBe(JSON.stringify({sentinel:"normal progress"}));expect(writes).toBe(0);
 expect(await page.evaluate(()=>window.__lingoAnalyticsEvents??[])).toEqual([]);
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
 await page.screenshot({path:"/tmp/lingo-testing-ui/testing-mobile.png",fullPage:true});
});
test("preview reaches the real lesson and paywall presentation without real checkout",async({page})=>{
 test.setTimeout(60000);await authorised(page);let writes=0,checkouts=0;
 await page.route("**/api/onboarding/progress**",r=>{writes++;return r.fulfill({json:{error:"Not allowed"},status:500});});
 await page.route("**/api/stripe/checkout",r=>{checkouts++;return r.fulfill({json:{error:"Not allowed"},status:500});});
 const state=initialState(new Date(),"test"),a=state.answers;
 a.goal.primary="travel";a.interests.keys=["restaurants"];a.level.selfReport="new";a.vocabBasic={shownIds:["wo"],selectedIds:[],noneKnown:true};a.vocabAdvanced={shownIds:[],selectedIds:[],noneKnown:false,skipped:true};a.usingPain={keys:["want_to_improve"],timing:"ongoing",upcomingText:null};a.learningPain={keys:[],hesitations:["dont_know_where_start"]};a.availability={minutes:"10",days:"5",session:null};
 for(const step of ["goal","interests","level","vocab_basic","vocab_advanced","using_pain","learning_pain","reviews","building","reflect"] as const)state.events[step]={completed_at:state.updatedAt};
 await page.addInitScript(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key:PREVIEW_STORAGE_KEY,state});
 await page.goto("/admin/testing");await page.getByRole("button",{name:"Open onboarding flow"}).click();await expect(page.getByTestId("first-lesson")).toBeVisible();await finishFirstLesson(page);
 await page.getByLabel("Your first name").fill("Tester");await page.getByTestId("commitment-cta").click();await expect(page.getByTestId("conversation-paywall")).toBeVisible();
 await page.getByRole("button",{name:/^(Start learning Mandarin|Start my plan|Activate my plan|Start my Mandarin plan)/}).click();await expect(page.getByText(/No checkout or charge was created/)).toBeVisible();expect(writes).toBe(0);expect(checkouts).toBe(0);
 await page.getByRole("button",{name:"Reset test run"}).click();await expect(page.getByTestId("onboarding-step")).toHaveAttribute("data-step","goal");
});
test("testing login rejects cross-origin submissions and bad passwords",async({request})=>{
 const cross=await request.post("/api/admin/testing-session",{headers:{Origin:"https://example.com"},data:{email:"ourlingoisland@gmail.com",password:"incorrect"}});expect(cross.status()).toBe(403);
 const wrong=await request.post("/api/admin/testing-session",{headers:{Origin:"http://localhost:3002"},data:{email:"ourlingoisland@gmail.com",password:"incorrect"}});expect(wrong.status()).toBe(401);expect(wrong.headers()["set-cookie"]).toBeUndefined();
});
