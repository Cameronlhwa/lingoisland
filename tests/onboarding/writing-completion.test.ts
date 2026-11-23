import test from "node:test";
import assert from "node:assert/strict";
import {writingCompletion} from "../../lib/onboarding/personalized/firstLesson/writing";
import {makeBudgetCourse} from "../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
import {GOALS} from "../../lib/onboarding/personalized/goals";
test("all authored question blanks produce an inline field and preserve reply context",()=>{
 for(const goal of GOALS)for(const variant of [0,1]){
  const practices=makeBudgetCourse(4,goal.key,variant).curriculum!.practices;
  for(const practice of practices.slice(0,2)){
   assert.equal(practice.kind,"writing");if(practice.kind!=="writing")continue;
   const completion=writingCompletion(practice.prompt);assert.ok(completion);
   assert.ok(["你想吃","你想参加","你想坐","你想看","你想学","你觉得"].includes(completion.prefix));
   assert.equal(completion.suffix,"？");assert.ok(completion.reply.includes("。"));
   assert.ok(practice.sample.hanzi.startsWith(completion.prefix));
   assert.ok(practice.sample.hanzi.endsWith(completion.suffix));
  }
 }
});
test("free writing and other prompt formats keep their existing answer box",()=>{
 for(const prompt of ["Make your own question using 还是.","Combine these ideas: 我喜欢中文。", "Complete: ___ and ___"])
  assert.equal(writingCompletion(prompt),null);
});
