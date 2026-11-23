import {test} from "node:test";
import assert from "node:assert/strict";
import {meaningQuizChoices,MAX_QUIZ_CHOICES} from "../../lib/onboarding/personalized/firstLesson/quizChoices";
import {makeBudgetCourse,type CourseTier} from "../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
import {GOALS} from "../../lib/onboarding/personalized/goals";
test("every target remains available exactly once with at most six choices, including the final partial group",()=>{
 for(let size=1;size<=30;size++){
  const pairs=Array.from({length:size},(_,i)=>({id:String(i),hanzi:String(i),pinyin:"",label:String(i),visual:"word"}));
  for(const target of pairs){const choices=meaningQuizChoices(pairs,target);assert.equal(choices.length,Math.min(size,MAX_QUIZ_CHOICES));assert.equal(choices.filter(w=>w.id===target.id).length,1);}
 }
});
test("all course words can still be tested across all levels, topics and variants",()=>{
 for(const tier of [1,2,3,4,5,6] as CourseTier[])for(const goal of GOALS)for(const variant of [0,1]){
  const lesson=makeBudgetCourse(tier,goal.key,variant);
  for(const target of lesson.match){const choices=meaningQuizChoices(lesson.match,target);assert.ok(choices.length<=6);assert.equal(choices.filter(w=>w.id===target.id).length,1);}
 }
});
