import {test} from "node:test";
import assert from "node:assert/strict";
import {beginPlacement,recordWordCheck,finishGrammarProbe,placementWordsToShow,placementAssessmentWords,parseCoursePlacement,placementFoundationIds,placeCourse} from "../../lib/onboarding/personalized/firstLesson/coursePlacement";
import {makeBudgetCourse,type CourseTier} from "../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
import {GOALS} from "../../lib/onboarding/personalized/goals";
test("draft selections stay visible until the screen is submitted",()=>{
 const p=beginPlacement(2,"heritage"),words=placementAssessmentWords(makeBudgetCourse(2,"heritage"));
 assert.deepEqual(placementWordsToShow(p),words);
 assert.deepEqual(placementWordsToShow({...p,evidence:{"会":true,"不":false}}),words);
});
test("follow-ups after moving down only show unseen words and retain positive and negative answers after reload",()=>{
 for(const tier of [2,3,4,5,6] as CourseTier[])for(const goal of GOALS){
  const p=recordWordCheck(beginPlacement(tier,goal.key),[]);
  const shown=placementAssessmentWords(makeBudgetCourse(tier,goal.key)).map(w=>w.id);
  assert.ok(placementWordsToShow(p).every(w=>!shown.includes(w.id)));
  const restored=parseCoursePlacement(JSON.parse(JSON.stringify(p)))!;
  assert.deepEqual(placementWordsToShow(restored),placementWordsToShow(p));
  const next=recordWordCheck(restored,placementWordsToShow(restored).map(w=>w.id));
  for(const id of shown)assert.equal(next.evidence[id],false);
 }
});
test("a grammar-driven level increase asks only unseen words",()=>{
 const c=makeBudgetCourse(4,"heritage");let p=recordWordCheck(beginPlacement(4,"heritage"),placementAssessmentWords(c).map(w=>w.id));
 p=finishGrammarProbe(p,true);assert.equal(p.tier,5);
 assert.ok(placementWordsToShow(p).every(w=>!p.checkedIds.includes(w.id)));
 assert.ok(placementWordsToShow(p).some(w=>w.id==="除了"));
});
test("old saved placements restart with sampled rules while preserving explicit evidence",()=>{
 const c=makeBudgetCourse(4,"heritage"),evidence=Object.fromEntries(c.match.map(w=>[w.id,placementFoundationIds(c).includes(w.id)]));
 const p=parseCoursePlacement({revision:"budget-v1",requestedTier:4,tier:1,variant:0,goal:"heritage",status:"ready",evidence,mastered:[],visited:["4:0","1:0"]})!;
 assert.equal(p.assessmentVersion,2);assert.equal(p.tier,4);assert.equal(p.status,"ready");assert.deepEqual(p.evidence,evidence);
});

test("promotion never falls back to a grammar pattern already passed",()=>{
 for(const tier of [3,4] as CourseTier[])for(const goal of GOALS){
  const initial=beginPlacement(tier,goal.key);
  let p=recordWordCheck(initial,placementWordsToShow(initial).map(w=>w.id));
  p=finishGrammarProbe(p,true);
  p=recordWordCheck(p,[]);
  if(p.status==="checking"&&!placementWordsToShow(p).length)p=placeCourse(p);
  assert.equal(p.tier,tier+1,`${tier}:${goal.key}`);
  assert.equal(p.status,"ready");
  const restored=parseCoursePlacement(JSON.parse(JSON.stringify(p)))!;
  assert.equal(restored.tier,p.tier);assert.equal(restored.status,"ready");
 }
});
test("an older saved fallback to a mastered course resumes the next course instead",()=>{
 const start=beginPlacement(4,"heritage");
 const passed=finishGrammarProbe(recordWordCheck(start,placementWordsToShow(start).map(w=>w.id)),true);
 const old={...passed,tier:4,status:"ready"};
 const restored=parseCoursePlacement(old)!;
 assert.equal(restored.tier,5);assert.equal(restored.status,"checking");
});

test("placement finishes after at most two word-check rounds across goals and levels",()=>{
 for(const tier of [2,3,4,5,6] as CourseTier[])for(const goal of GOALS){
  let p=beginPlacement(tier,goal.key);
  p=recordWordCheck(p,[]);
  if(p.status==="checking")p=recordWordCheck(parseCoursePlacement(JSON.parse(JSON.stringify(p)))!,[]);
  assert.equal(p.status,"ready",`${tier}:${goal.key}`);
  assert.ok((p.wordCheckRounds??0)<=2);
  assert.equal(parseCoursePlacement(JSON.parse(JSON.stringify(p)))!.status,"ready");
 }
});
test("saved placements already beyond two rounds proceed without another word screen",()=>{
 const p=parseCoursePlacement({...beginPlacement(6,"heritage"),tier:3,visited:["6:0","5:0","4:0"],wordCheckRounds:undefined})!;
 assert.equal(p.status,"ready");assert.equal(p.tier,1);
});
