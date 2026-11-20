import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState, parseFirstLesson } from "../../lib/onboarding/personalized/flow";
import { GOALS } from "../../lib/onboarding/personalized/goals";
import { makeBudgetCourse, type CourseTier } from "../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
import { beginPlacement, recordWordCheck, finishGrammarProbe, newItems, parseCoursePlacement, fitsBudget } from "../../lib/onboarding/personalized/firstLesson/coursePlacement";
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
test("all 72 authored versions have one family, two topic items, and no hidden Chinese dependencies",()=>{
 for(const goal of GOALS)for(const tier of tiers)for(const variant of [0,1]){
  const c=makeBudgetCourse(tier,goal.key,variant),b=c.budget;
  assert.equal(b.topicIds.length,2);assert.ok(b.grammarIds.length+b.topicIds.length<=5);
  assert.equal(new Set(c.match.map(w=>w.id)).size,c.match.length);
  assert.deepEqual(new Set(c.curriculum!.vocabularyGroups.flatMap(g=>g.wordIds)),new Set(c.match.map(w=>w.id)));
  for(const text of allChinese(c))assert.ok(canSegment(text,c.match.map(w=>w.hanzi)),`${c.id}: ${text}`);
  for(const build of [c.build,c.transferBuild])assert.equal(build.order.map(id=>build.chunks.find(w=>w.id===id)!.label).join(""),build.result.hanzi);
  assert.equal(c.chat.choices.filter(w=>w.id===c.chat.expectedChoiceId).length,1);
  assert.ok(c.curriculum!.cards.length<=2);assert.ok(c.curriculum!.practices.length<=3);
  assert.ok(c.curriculum!.practices.every(p=>p.kind!=="writing"&&p.kind!=="reading"));
 }
});
test("every familiarity combination yields a safe ready course or a bounded next check",()=>{
 for(const goal of GOALS)for(const tier of tiers){const course=makeBudgetCourse(tier,goal.key);
  for(let mask=0;mask<2**course.match.length;mask++){
   const known=course.match.filter((_,i)=>mask&(1<<i)).map(w=>w.id);
   let p=recordWordCheck(beginPlacement(tier,goal.key),known),checks=1;
   // All additionally queried vocabulary is explicitly unfamiliar in this adversarial path.
   while(p.status==="checking"&&checks<4){p=recordWordCheck(p,Object.keys(p.evidence).filter(id=>p.evidence[id]));checks++;}
   assert.ok(checks<=3,JSON.stringify({tier,mask,checks,p}));
   if(p.status==="ready")assert.ok(fitsBudget(makeBudgetCourse(p.tier,goal.key,p.variant),p.evidence));
   else assert.equal(p.status,"probe");
   const active=makeBudgetCourse(p.tier,goal.key,p.variant);
   assert.ok(newItems(active,p.evidence).length<=5);
   assert.equal(active.budget.topicIds.length,2);
  }
 }
});
test("same grammar swaps topic words before lowering a course",()=>{
 let p=beginPlacement(4,"heritage"),c=makeBudgetCourse(4,"heritage");
 // Know its supporting vocabulary and grammar, but need fresh topic words.
 p=recordWordCheck(p,c.match.map(w=>w.id));assert.equal(p.variant,1);assert.equal(p.tier,4);
 c=makeBudgetCourse(p.tier,p.goal,p.variant);p=recordWordCheck(p,c.budget.words.filter(w=>!c.budget.topicIds.includes(w.id)).map(w=>w.id));
 assert.equal(p.status,"ready");assert.equal(p.tier,4);assert.equal(newItems(c,p.evidence).length,2);
});
test("familiar vocabulary requires demonstrated grammar; a failed check keeps the same course",()=>{
 let p=beginPlacement(4,"travel");p=recordWordCheck(p,makeBudgetCourse(4,"travel").match.map(w=>w.id));p=recordWordCheck(p,makeBudgetCourse(4,"travel",1).match.map(w=>w.id));
 assert.equal(p.status,"probe");const failed=finishGrammarProbe(p,false);assert.equal(failed.tier,4);assert.equal(failed.status,"ready");
 const passed=finishGrammarProbe(p,true);assert.equal(passed.tier,5);assert.equal(passed.status,"checking");assert.ok(passed.mastered.includes(4));
});
test("explicit unfamiliar answers override earlier known evidence and survive storage",()=>{
 let p=beginPlacement(3,"work",{"我":true,"你":true,"不":true,"吗":true});
 const c=makeBudgetCourse(3,"work");p=recordWordCheck(p,c.match.filter(w=>w.id!=="我").map(w=>w.id));assert.equal(p.evidence["我"],false);
 const parsed=parseFirstLesson({coursePlacement:p});assert.equal(parsed.coursePlacement!.evidence["我"],false);
 assert.equal(parseCoursePlacement({...p,revision:"old"}),undefined);
 assert.equal(parseCoursePlacement({...p,tier:99}),undefined);
 const forged=parseCoursePlacement({...beginPlacement(4,"work"),status:"ready"});assert.equal(forged!.status,"checking");
});
test("a fitted course survives refresh and retains its topic variant without changing self report",()=>{
 const a=initialState(new Date(),"test").answers;a.level.selfReport="basic_conversations";a.goal.primary="heritage";
 let p=beginPlacement(4,"heritage");p=recordWordCheck(p,makeBudgetCourse(4,"heritage").budget.prerequisiteIds);
 assert.equal(p.status,"ready");a.firstLesson={...a.firstLesson,coursePlacement:p};
 const first=updatedFirstLesson(a)!;a.firstLesson=parseFirstLesson(a.firstLesson);assert.equal(updatedFirstLesson(a)!.id,first.id);assert.equal(a.level.selfReport,"basic_conversations");assert.notEqual(first.id,"curriculum-v2-4-heritage-dinner");
});
