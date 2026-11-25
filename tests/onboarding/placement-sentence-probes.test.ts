import {test} from "node:test";
import assert from "node:assert/strict";
import {makeBudgetCourse,type CourseTier} from "../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
import {GOALS} from "../../lib/onboarding/personalized/goals";

for(const tier of [1,2,3,4,5,6] as CourseTier[])test(`level ${tier}: every topic and variant uses complete sentence placement choices`,()=>{
 for(const goal of GOALS)for(const variant of [0,1]){
  const course=makeBudgetCourse(tier,goal.key,variant);
  assert.equal(course.budget.probes.length,2);
  for(const question of course.budget.probes){
   assert.match(question.prompt,/[A-Za-z]/);
   assert.doesNotMatch(question.prompt,/[\u3400-\u9fff_]/);
   assert.equal(question.choices.length,2);
   assert.equal(new Set(question.choices.map(c=>c.hanzi)).size,2);
   const right=question.choices.find(c=>c.id===question.correct)!;
   assert.ok(right);assert.equal(right.meaning,question.prompt);
   for(const choice of question.choices){assert.match(choice.hanzi,/[。！？]$/);assert.ok(choice.hanzi.length>=3);assert.ok(choice.pinyin);}
  }
 }
});
test("ability checks distinguish positive and negative sentences using the same action",()=>{
 for(const tier of [2,3] as CourseTier[]){
  const [positive,negative]=makeBudgetCourse(tier,"work").budget.probes;
  assert.match(positive.choices.find(c=>c.id!==positive.correct)!.hanzi,/不/);
  assert.match(negative.choices.find(c=>c.id===negative.correct)!.hanzi,/不/);
 }
});
