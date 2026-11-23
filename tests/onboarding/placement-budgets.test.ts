import {test} from "node:test";
import assert from "node:assert/strict";
import {makeBudgetCourse,type CourseTier} from "../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
import {beginPlacement,recordWordCheck,parseCoursePlacement,placementTargetIds,placementFoundationIds,placementAssessmentWords,placementWordsToShow,finishGrammarProbe} from "../../lib/onboarding/personalized/firstLesson/coursePlacement";
import {GOALS} from "../../lib/onboarding/personalized/goals";
const tiers:CourseTier[]=[1,2,3,4,5,6];
test("all levels and topics show three targets and only relevant separate foundations",()=>{
 for(const tier of tiers)for(const goal of GOALS)for(const variant of [0,1]){
  const c=makeBudgetCourse(tier,goal.key,variant),targets=placementTargetIds(c),foundations=placementFoundationIds(c);
  assert.equal(targets.length,3);assert.ok(foundations.length<=6);if(tier>=3)assert.ok(foundations.length>=4);
  assert.ok(foundations.every(id=>!targets.includes(id)&&!c.budget.grammarIds.includes(id)&&!c.budget.topicIds.includes(id)));
  assert.equal(new Set(placementAssessmentWords(c).map(w=>w.id)).size,3+foundations.length);
  if(tier>=4)assert.ok(targets.length<c.budget.grammarIds.length+c.budget.topicIds.length);
 }
});
test("unfamiliar lesson targets never lower any level when the foundations are known",()=>{
 for(const tier of tiers)for(const goal of GOALS)for(const variant of [0,1]){
  const c=makeBudgetCourse(tier,goal.key,variant);
  const p=recordWordCheck({...beginPlacement(tier,goal.key),variant},placementFoundationIds(c));
  assert.equal(p.tier,tier,c.id);assert.equal(p.status,"ready",c.id);
  const checked=new Set(placementAssessmentWords(c).map(w=>w.id));
  for(const w of c.match)if(!checked.has(w.id))assert.equal(p.evidence[w.id],undefined,`${c.id}: unshown ${w.id}`);
  const restored=parseCoursePlacement(JSON.parse(JSON.stringify(p)))!;assert.equal(restored.tier,tier);assert.equal(restored.status,"ready");
 }
});
test("every target and foundation familiarity combination follows the separate placement rules",()=>{
 for(const tier of tiers)for(const goal of GOALS){
  const c=makeBudgetCourse(tier,goal.key),words=placementAssessmentWords(c),foundation=placementFoundationIds(c),targets=placementTargetIds(c);
  for(let mask=0;mask<2**words.length;mask++){
   const known=words.filter((_,i)=>mask&(1<<i)).map(w=>w.id),missing=foundation.filter(id=>!known.includes(id)).length;
   const p=recordWordCheck(beginPlacement(tier,goal.key),known);
   if(tier>1&&missing>foundation.length/2){assert.equal(p.tier,tier-1);assert.equal(p.status,"checking");}
   else{assert.equal(p.tier,tier);assert.equal(p.status,targets.every(id=>known.includes(id))?"probe":"ready");}
  }
 }
});
test("one or two missing foundations stay in the same course; more than half asks one level down",()=>{
 for(const tier of [3,4,5,6] as CourseTier[]){
  const c=makeBudgetCourse(tier,"heritage"),f=placementFoundationIds(c);
  for(const missing of [1,2])assert.equal(recordWordCheck(beginPlacement(tier,"heritage"),f.slice(missing)).tier,tier);
  const p=recordWordCheck(beginPlacement(tier,"heritage"),[]);assert.equal(p.tier,tier-1);
  for(const w of placementWordsToShow(p))assert.equal(p.evidence[w.id],undefined);
 }
});
test("known sampled targets require a passed grammar check before moving up",()=>{
 for(const tier of tiers){
  const c=makeBudgetCourse(tier,"heritage"),p=recordWordCheck(beginPlacement(tier,"heritage"),placementAssessmentWords(c).map(w=>w.id));
  assert.equal(p.status,"probe");assert.equal(finishGrammarProbe(p,false).tier,tier);assert.equal(finishGrammarProbe(p,false).status,"ready");
  const passed=finishGrammarProbe(p,true);assert.equal(passed.tier,Math.min(6,tier+1));assert.equal(passed.status,tier===6?"ready":"checking");
 }
});
