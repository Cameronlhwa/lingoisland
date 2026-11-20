import {beginPlacement,recordWordCheck} from "../../lib/onboarding/personalized/firstLesson/coursePlacement";
import {makeBudgetCourse,type CourseTier} from "../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
import {grammarSteps} from "../../lib/onboarding/personalized/firstLesson/grammarSequence";
import {test,expect,type Page} from "@playwright/test";
import {initialState,LOCAL_STORAGE_KEY,stepsFor} from "../../lib/onboarding/personalized/flow";
import {updatedFirstLesson} from "../../lib/onboarding/personalized/firstLesson/curriculum";
import type {GoalKey} from "../../lib/onboarding/personalized/goals";
import type {SelfReportKey} from "../../lib/onboarding/personalized/levels";
import {advanceLesson} from "./helpers/firstLesson";
import AxeBuilder from "@axe-core/playwright";
async function setup(page:Page,level:SelfReportKey,goal:GoalKey,knownWords:string[]=[],startConcept?:string){
 const state=initialState(new Date(),"test"),a=state.answers;
 a.goal.primary=goal;a.level.selfReport=level;a.interests.keys=["food"];
 a.experience.key=level==="new"?"not_started":"under_6_months";
 a.vocabBasic={shownIds:knownWords.length?knownWords:["wo","ni"],selectedIds:knownWords,noneKnown:knownWords.length===0};a.vocabAdvanced={shownIds:[],selectedIds:[],noneKnown:false,skipped:true};
 a.usingPain={keys:["want_to_improve"],timing:"ongoing",upcomingText:null};a.learningPain={keys:["not_relevant"],hesitations:["dont_know_where_start"]};a.availability={minutes:"5",days:"3",session:null};
 const tier=(["new","few_words","simple_sentences","basic_conversations","familiar_topics","complex_topics"].indexOf(level)+1) as CourseTier;
 const candidate=makeBudgetCourse(tier,goal),placement=recordWordCheck(beginPlacement(tier,goal),candidate.budget.prerequisiteIds);
 a.firstLesson={...a.firstLesson,lessonId:candidate.id,coursePlacement:placement,vocabularyKnownIds:candidate.budget.prerequisiteIds,vocabularyChecked:true};
 if(startConcept){const lesson=updatedFirstLesson(a)!;
  if(startConcept==="chat"||startConcept==="discussion")a.firstLesson={...a.firstLesson,lessonId:lesson.id,phase:startConcept,selectedDrinkId:startConcept==="discussion"?lesson.chat.expectedChoiceId!:null,xpAwarded:["meaning","build","speaking"]};
  else {const stepId=["reading","writing"].includes(startConcept)?grammarSteps(lesson.curriculum!).find(s=>s.kind==="practice"&&s.practice.kind===startConcept)!.id:`${startConcept}:teach`;a.firstLesson={...a.firstLesson,lessonId:lesson.id,phase:"frame",grammarStepId:stepId,xpAwarded:["meaning"]};}
 }
 for(const step of stepsFor(a)){if(step==="first_lesson")break;state.events[step]={completed_at:state.updatedAt};}
 await page.addInitScript(({state,key})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(state));},{state,key:LOCAL_STORAGE_KEY});
 await page.route("**/flags/**",r=>r.fulfill({json:{featureFlags:{"mini-lesson-onboarding":"test"},featureFlagPayloads:{}}}));
 await page.route("**/api/onboarding/progress**",r=>r.fulfill({json:r.request().method()==="GET"?{account:{kind:"user",firstName:"Test"},progress:null}:{status:"saved",progress:r.request().postDataJSON().state}}));
 await page.route("**/api/onboarding/abandon**",r=>r.fulfill({json:{status:"ok"}}));
 await page.route("**/api/entitlements**",r=>r.fulfill({json:{isPro:false}}));
 await page.goto("/onboarding/journey?resume=first_lesson",{waitUntil:"domcontentloaded"});await expect(page.getByTestId(startConcept==="chat"||startConcept==="discussion"?"lesson-chat":startConcept?"grammar-practice":"lesson-intro")).toBeVisible({timeout:60000});
 return updatedFirstLesson(a)!;
}
test.use({launchOptions:{args:["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream","--autoplay-policy=no-user-gesture-required"]}});
test("recording keeps the real target, retries, scores, and continuation after refresh",async({page})=>{
 test.setTimeout(90000);
 await page.context().grantPermissions(["microphone"]);
 const lesson=await setup(page,"few_words","heritage");
 const targets:string[]=[];
 await page.route("**/api/onboarding/pronunciation",r=>{
  const body=r.request().postDataBuffer()!.toString();targets.push(body);
  const characters=Array.from(lesson.targets[0].hanzi).map((hanzi,i)=>({hanzi,pinyin:i===0?"wǒ":"huì",score:i===0?92:45,targetTone:i===0?3:4}));
  return r.fulfill({json:{status:"ok",feedback:"close",overall:72,tone:65,characters}});
 });
 await advanceLesson(page,"baseline");
 for(let i=0;i<3;i++){
  await page.getByTestId(i===0?"lesson-baseline-record":"lesson-coach-record").click();
  await expect(page.getByTestId("lesson-stop")).toBeVisible();await page.waitForTimeout(1000);await page.getByTestId("lesson-stop").click();
  await expect(page.getByTestId("pronunciation-results")).toBeVisible();
 }
 expect(targets).toHaveLength(3);for(const body of targets)expect(body).toContain(lesson.targets[0].hanzi);
 await expect(page.getByTestId("lesson-coach-record")).toHaveCount(0);
 await page.reload();await expect(page.getByTestId("pronunciation-piece-0")).toHaveAttribute("data-band","clear");await expect(page.getByTestId("pronunciation-piece-1")).toHaveAttribute("data-band","practice");
 await page.getByTestId("lesson-baseline-continue").click();await advanceLesson(page,"chat");
 await page.getByTestId(`lesson-choice-${lesson.chat.expectedChoiceId}`).click();await page.getByTestId("lesson-chat-skip-speak").click();await expect(page.getByText("Delivered",{exact:true})).toBeVisible();
});
for(const [concept,format,level] of [["family-2","pattern","few_words"],["family-4","contrast","basic_conversations"],["ability-question","exchange","few_words"]] as const)test(`${format}: teaching-only design, responsive layout, audio and separate assessment`,async({page})=>{
 test.setTimeout(60000);const lesson=await setup(page,level,"heritage",[],concept);
 await page.evaluate(()=>{const spoken:string[]=[];(window as Window & {__spoken?:string[]}).__spoken=spoken;window.speechSynthesis.speak=(utterance:SpeechSynthesisUtterance)=>{spoken.push(utterance.text);};});
 // Keep static screenshots and contrast measurements stable while Axe samples styles.
 await page.addStyleTag({content:"*,*::before,*::after{transition:none!important;animation:none!important;}"});
 const teaching=page.getByTestId("grammar-teaching");await expect(teaching).toHaveAttribute("data-teaching-format",format);
 await expect(teaching.locator("img")).toHaveCount(1);
 await expect.poll(()=>teaching.locator("img").evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBe(true);
 await expect(page.getByTestId("grammar-check")).toHaveCount(0);
 const card=lesson.curriculum!.cards.find(c=>c.id===concept)!;
 await teaching.getByRole("button",{name:`Listen: ${card.examples[0].hanzi}`,exact:true}).click();
 expect(await page.evaluate(()=>(window as Window & {__spoken?:string[]}).__spoken)).toEqual([card.examples[0].hanzi]);
 for(const width of [1280,390,320]){
  await page.setViewportSize({width,height:width===1280?900:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const results=await new AxeBuilder({page}).include("#onboarding-main").withTags(["wcag2a","wcag2aa"]).analyze();expect(results.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)}))).toEqual([]);
  if(width!==320)await page.screenshot({path:`/tmp/lingo-teaching-redesign/${format}-${width}.png`,fullPage:true});
 }
 await page.reload();await expect(page.getByTestId("grammar-practice")).toHaveAttribute("data-grammar-step",`${concept}:teach`);
 await page.getByTestId("grammar-continue").click();await expect(page.getByTestId("grammar-practice")).toHaveAttribute("data-grammar-step",`${concept}:check`);
 await expect(page.getByTestId("grammar-teaching")).toHaveCount(0);await expect(page.getByTestId("grammar-choice")).toBeVisible();
 await page.getByRole("button",{name:"Previous lesson step",exact:true}).click();await expect(page.getByTestId("grammar-practice")).toHaveAttribute("data-grammar-step",`${concept}:teach`);
 await page.getByTestId("grammar-continue").click();await page.reload();
 await expect(page.getByTestId("grammar-practice")).toHaveAttribute("data-grammar-step",`${concept}:check`);
 const check=card.check;if(check.kind!=="choice")throw new Error("Expected a choice assessment");
 await page.getByTestId(`grammar-option-${check.correct}`).click();await page.getByTestId("grammar-check").click();
 await expect(page.getByTestId("grammar-check")).toHaveText("Continue");
 await expect(page.locator("[data-pronunciation-celebration]")).toHaveCount(1);
});

test("final delivered chat shows nearly complete progress and completion fills the bar",async({page})=>{
 test.setTimeout(60000);const lesson=await setup(page,"few_words","work",[],"family-2");
 await advanceLesson(page,"chat");
 const bar=page.getByRole("progressbar",{name:"Lesson progress",exact:true});
 expect(Number(await bar.getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(90);
 await page.getByTestId(`lesson-choice-${lesson.chat.expectedChoiceId}`).click();await page.getByTestId("lesson-chat-skip-speak").click();
 await expect(page.getByTestId("lesson-chat-finish")).toBeEnabled();
 expect(Number(await bar.getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(97);
 expect(Number(await bar.getAttribute("aria-valuenow"))).toBeLessThan(100);
 await page.screenshot({path:"/tmp/lingo-final-chat-progress.png",fullPage:true});
 await page.reload();expect(Number(await bar.getAttribute("aria-valuenow"))).toBeGreaterThanOrEqual(97);
 await page.getByTestId("lesson-chat-finish").click();await page.getByTestId("lesson-note-continue").click();
 await expect(bar).toHaveAttribute("aria-valuenow","100");
});


for(const [level,stage] of [["new","chat"],["few_words","chat"],["simple_sentences","chat"],["familiar_topics","chat"],["complex_topics","chat"]] as const)test(`${level}/${stage}: compact chat stays readable, replays audio and sends the intended reply`,async({page})=>{
 test.setTimeout(60000);const lesson=await setup(page,level,"heritage",[],stage);
 const chat=lesson.chat;
 await page.evaluate(()=>{(window as Window & {__spoken?:string[]}).__spoken=[];window.speechSynthesis.speak=(u:SpeechSynthesisUtterance)=>(window as Window & {__spoken?:string[]}).__spoken!.push(u.text);});
 await page.getByRole("button",{name:`Replay question: ${chat.huahua.hanzi}`,exact:true}).click();
 expect(await page.evaluate(()=>(window as Window & {__spoken?:string[]}).__spoken)).toEqual([chat.huahua.hanzi]);
 await expect(page.getByTestId("lesson-chat-record")).toBeDisabled();await expect(page.getByTestId("lesson-chat-skip-speak")).toBeDisabled();
 await expect(page.getByText("Your practice partner",{exact:true})).toHaveCount(0);
 const replies=page.getByTestId("chat-replies");const options=replies.getByRole("button");
 for(const p of chat.choices)await expect(page.getByTestId(`lesson-choice-${p.id}`)).not.toContainText(p.meaning);
 await page.getByTestId(`lesson-choice-${chat.expectedChoiceId}`).focus();await page.keyboard.press("Space");
 await expect(page.getByTestId(`lesson-choice-${chat.expectedChoiceId}`)).toHaveAttribute("aria-pressed","true");
 await expect(page.getByTestId("lesson-chat-record")).toBeEnabled();
 await page.addStyleTag({content:"*,*::before,*::after{transition:none!important;animation:none!important;}"});
 for(const width of [1280,390,320]){
  await page.setViewportSize({width,height:width===1280?900:844});await page.evaluate(()=>window.scrollTo(0,0));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  const boxes=await options.evaluateAll(nodes=>nodes.map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y})));
  if(width===1280&&chat.choices.every(p=>p.hanzi.length<=12)){expect(boxes[0].y).toBe(boxes[1].y);expect(boxes[0].x).toBeLessThan(boxes[1].x);}
  else expect(boxes[0].y).toBeLessThan(boxes[1].y);
  const results=await new AxeBuilder({page}).include("#onboarding-main").withTags(["wcag2a","wcag2aa"]).analyze();expect(results.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.failureSummary)}))).toEqual([]);
  if(width===1280&&["new","few_words","simple_sentences"].includes(level)){
   const bottom=await page.getByTestId("lesson-chat-skip-speak").evaluate(n=>n.getBoundingClientRect().bottom);expect(bottom).toBeLessThanOrEqual(840);
  }
  if(level==="simple_sentences"&&width!==320)await page.screenshot({path:`/tmp/lingo-compact-chat-${width}.png`,fullPage:true});
 }
 await page.getByTestId("lesson-chat-skip-speak").click();await expect(page.getByText("Delivered",{exact:true})).toBeVisible();await expect(page.getByTestId("lesson-chat-finish")).toBeEnabled();
 await page.reload();await expect(page.getByText("Delivered",{exact:true})).toBeVisible();await expect(page.getByTestId("chat-replies")).toHaveCount(0);
});

test("compact chat records and sends the selected Mandarin reply",async({page})=>{
 test.setTimeout(60000);await page.context().grantPermissions(["microphone"]);const lesson=await setup(page,"simple_sentences","heritage",[],"chat");
 const target=lesson.chat.choices.find(p=>p.id===lesson.chat.expectedChoiceId)!;let payload="";
 await page.route("**/api/onboarding/pronunciation",r=>{payload=r.request().postDataBuffer()!.toString();return r.fulfill({json:{status:"unavailable"}});});
 await page.getByTestId(`lesson-choice-${target.id}`).click();await page.getByTestId("lesson-chat-record").click();await expect(page.getByTestId("lesson-stop")).toBeVisible();await page.waitForTimeout(1000);await page.getByTestId("lesson-stop").click();
 await expect(page.getByText("Delivered",{exact:true})).toBeVisible();expect(payload).toContain(target.hanzi.replace(/[，。！？、\s]/g,""));
});
