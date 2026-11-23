import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState, parseFirstLesson } from "../../lib/onboarding/personalized/flow";
import { GOALS } from "../../lib/onboarding/personalized/goals";
import { makeBudgetCourse, type CourseTier } from "../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
import { beginPlacement, recordWordCheck, finishGrammarProbe, newItems, parseCoursePlacement, fitsBudget, courseNewItemLimit } from "../../lib/onboarding/personalized/firstLesson/coursePlacement";
import { updatedFirstLesson } from "../../lib/onboarding/personalized/firstLesson/curriculum";
const tiers:CourseTier[]=[1,2,3,4,5,6];
function canSegment(text:string,words:string[]):boolean {
 const reachable=new Set([0]);for(let i=0;i<text.length;i++)if(reachable.has(i))for(const word of words)if(text.startsWith(word,i))reachable.add(i+word.length);return reachable.has(text.length);
}
function allChinese(value:unknown):string[] {
 if(typeof value==="string")return value.match(/[\u3400-\u9fff]+/g)??[];
 if(Array.isArray(value))return value.flatMap(allChinese);
 if(value&&typeof value==="object")return Object.values(value).flatMap(allChinese);
 return [];
}
test("all authored versions have the required vocabulary groups and valid sentence data",()=>{
 for(const goal of GOALS)for(const tier of tiers)for(const variant of [0,1]){
  const c=makeBudgetCourse(tier,goal.key,variant),b=c.budget;
  assert.equal(b.topicIds.length,tier===4?3:tier===5?4:2);if(tier<=3)assert.ok(b.grammarIds.length+b.topicIds.length<=5);
  assert.equal(new Set(c.match.map(w=>w.id)).size,c.match.length);
  assert.deepEqual(new Set(c.curriculum!.vocabularyGroups.flatMap(g=>g.wordIds)),new Set(c.match.map(w=>w.id)));
  if(tier<=3)for(const text of allChinese(c))assert.ok(canSegment(text,c.match.map(w=>w.hanzi)),`${c.id}: ${text}`);
  for(const build of [c.build,c.transferBuild])assert.equal(build.order.map(id=>build.chunks.find(w=>w.id===id)!.label).join("").replace(/[，。！？、；]/g,""),build.result.hanzi.replace(/[，。！？、；]/g,""));
  assert.equal(c.chat.choices.filter(w=>w.id===c.chat.expectedChoiceId).length,1);
  if(tier<=3){assert.ok(c.curriculum!.cards.length<=2);assert.ok(c.curriculum!.practices.length<=3);assert.ok(c.curriculum!.practices.every(p=>p.kind!=="writing"&&p.kind!=="reading"));}
 }
});
test("stored placement refuses invalid revisions, tiers and unconfirmed readiness",()=>{
 assert.equal(parseCoursePlacement({...beginPlacement(4,"work"),revision:"old"}),undefined);
 assert.equal(parseCoursePlacement({...beginPlacement(4,"work"),tier:99}),undefined);
 assert.equal(parseCoursePlacement({...beginPlacement(4,"work"),status:"ready"})!.status,"checking");
});
test("a fitted course survives refresh and retains its topic variant without changing self report",()=>{
 const a=initialState(new Date(),"test").answers;a.level.selfReport="basic_conversations";a.goal.primary="heritage";
 let p=beginPlacement(4,"heritage");p=recordWordCheck(p,makeBudgetCourse(4,"heritage").budget.prerequisiteIds);
 assert.equal(p.status,"ready");assert.equal(p.tier,4);a.firstLesson={...a.firstLesson,coursePlacement:p};
 const first=updatedFirstLesson(a)!;a.firstLesson=parseFirstLesson(a.firstLesson);assert.equal(updatedFirstLesson(a)!.id,first.id);assert.equal(a.level.selfReport,"basic_conversations");assert.notEqual(first.id,"curriculum-v2-4-heritage-dinner");
});
