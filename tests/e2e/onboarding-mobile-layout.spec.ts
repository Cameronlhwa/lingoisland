import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync,rmSync} from 'node:fs';
const path='app/onboarding-mobile-review';

test.beforeEach(async({page})=>{
 await page.route('**/array/**',route=>route.fulfill({contentType:'application/javascript',body:''}));
 await page.route('**/flags/**',route=>route.fulfill({json:{featureFlags:{'mini-lesson-onboarding':'test'},featureFlagPayloads:{}}}));
});
test.beforeAll(()=>{mkdirSync(path,{recursive:true});writeFileSync(`${path}/page.tsx`,'import {Suspense} from "react";import Harness from "@/tests/e2e/helpers/OnboardingMobileHarness";export default function Page(){return <Suspense><Harness/></Suspense>;}');});
test.afterAll(()=>{rmSync(path,{recursive:true,force:true});rmSync('.next/types/app/onboarding-mobile-review',{recursive:true,force:true});});
const screens=['goal','interests','level','vocab_basic','vocab_advanced','experience','using_pain','learning_pain','reviews','pronunciation','availability','reflect','reflect_test','commitment','commitment_test','first_lesson'];
async function open(page:import('@playwright/test').Page,screen:string){
 await page.route('**/api/**',route=>route.fulfill({json:{lesson:null}}));
 await page.goto(`/onboarding-mobile-review?screen=${screen}`,{waitUntil:"domcontentloaded"});
 await expect(page.locator('[data-mobile-ready="true"]')).toBeVisible({timeout:15000});
 await expect(page.getByRole('heading',{level:1})).toBeVisible();
 await page.evaluate(()=>document.fonts.ready);
}
test('onboarding primary actions remain within reach at three mobile sizes',async({page})=>{
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
 for(const size of [{width:390,height:844},{width:375,height:667},{width:320,height:568}]){
  await page.setViewportSize(size);
  for(const screen of screens){
   await open(page,screen);
   if(screen.startsWith('vocab'))await expect(page.getByTestId('vocab-none-known')).toBeInViewport();
   if(screen==='first_lesson')await expect(page.getByTestId('course-placement-continue')).toBeVisible();
   const action=page.locator('button').filter({visible:true}).filter({hasText:/^(Continue|Build my plan|I’m ready|Start my first lesson|Find my lesson|Try it)/}).first();
   await expect(action).toBeVisible();
   const rect=await action.boundingBox();expect(rect!.y).toBeGreaterThanOrEqual(0);expect(rect!.y+rect!.height,`${screen} at ${size.width}`).toBeLessThanOrEqual(size.height);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
   if(size.width===390&&['goal','level','availability','using_pain','reflect','first_lesson'].includes(screen)) await page.screenshot({path:`/tmp/onboarding-mobile-review/verified-${screen}.png`,fullPage:true,animations:'disabled'});
  }
 }
 expect(errors).toEqual([]);
});
test('mobile choices retain their selection and the fixed action advances once',async({page})=>{
 await page.setViewportSize({width:375,height:667});await open(page,'level');
 await page.getByTestId('level-complex_topics').click();
 await expect(page.getByTestId('level-complex_topics')).toHaveAttribute('aria-pressed','true');
 await expect(page.getByTestId('level-complex_topics')).toContainText('Opinions and abstract ideas');
 const box=await page.getByTestId('level-complex_topics').boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);
 await page.getByTestId('continue').click();await expect(page.getByTestId('advanced')).toBeVisible();
});
test('mobile timing and schedule choices preserve the existing answers',async({page})=>{
 await page.setViewportSize({width:375,height:667});await open(page,'using_pain');
 await page.getByTestId('timing-select').selectOption('upcoming_event');
 await expect(page.getByLabel('What’s coming up? (optional)')).toBeVisible();
 await page.getByLabel('What’s coming up? (optional)').fill('A client visit');
 await page.getByTestId('continue').click();await expect(page.getByTestId('advanced')).toBeVisible();
 await open(page,'availability');await page.getByTestId('minutes-30').click();await page.getByTestId('days-varies').click();await page.getByTestId('session-short_sessions').click();
 await expect(page.getByTestId('minutes-30')).toHaveAttribute('aria-pressed','true');
 await expect(page.getByTestId('session-short_sessions')).toHaveAttribute('aria-pressed','true');
 await page.getByTestId('continue').click();await expect(page.getByTestId('advanced')).toBeVisible();
});
test('optional plan detail remains available and keyboard-sized viewports keep the action reachable',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page,'reflect_test');
 await page.getByText('Why this plan fits you',{exact:true}).click();await expect(page.getByTestId('reflect-fixes').first()).toBeVisible();
 await open(page,'goal');await page.getByTestId('goal-school').click();await page.getByTestId('goal-other').click();
 await page.setViewportSize({width:390,height:450});await page.getByLabel('Tell us in a few words (optional)').fill('Travel with friends');
 expect(await page.getByLabel('Tell us in a few words (optional)').evaluate(el=>getComputedStyle(el).fontSize)).toBe('16px');
 const rect=await page.getByTestId('continue').boundingBox();expect(rect!.y+rect!.height).toBeLessThanOrEqual(450);
 await page.getByTestId('continue').click();await expect(page.getByTestId('advanced')).toBeVisible();
});
test('payment options and billing disclosure fit without expanding the optional chart',async({page})=>{
 for(const size of [{width:390,height:844},{width:375,height:667}]){
  await page.setViewportSize(size);await open(page,'paywall');
  await expect(page.getByTestId('conversation-price')).toContainText('Billed monthly');
  const action = await page.getByTestId('conversation-continue').boundingBox();expect(action!.y+action!.height).toBeLessThanOrEqual(size.height);
  await page.getByTestId('plan-yearly').click();await expect(page.getByTestId('conversation-price')).toContainText('Cancel anytime');
  await page.getByText('See your learning outlook',{exact:true}).click();await expect(page.locator('details[open]')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
 }
});
test('desktop keeps the overview layout with an inline action',async({page})=>{
 await page.setViewportSize({width:1440,height:1000});await open(page,'goal');
 expect(await page.getByTestId('continue').evaluate(el=>getComputedStyle(el.parentElement!).position)).not.toBe('fixed');
 await expect(page.getByText('Clients, colleagues, and professional situations',{exact:true})).toBeVisible();
 await open(page,'using_pain');await expect(page.getByTestId('timing-select')).toBeHidden();await expect(page.getByTestId('timing-ongoing')).toBeVisible();
});
