import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../../lib/onboarding/personalized/flow";
import { updatedFirstLesson } from "../../lib/onboarding/personalized/firstLesson/curriculum";
import { grammarSteps } from "../../lib/onboarding/personalized/firstLesson/grammarSequence";
import { curriculumProgress } from "../../lib/onboarding/personalized/firstLesson/lessonProgress";
for (const level of ["new","few_words","simple_sentences","basic_conversations","familiar_topics","complex_topics"] as const) test(`${level}: progress follows activities and reaches the end after the final exchange`,()=>{
 const a=initialState(new Date()).answers;a.level.selfReport=level;a.goal.primary="work";
 const lesson=updatedFirstLesson(a)!;
 for(const known of [[],lesson.match.map(w=>w.id)]){
  const p={...a.firstLesson,vocabularyKnownIds:known};
  assert.equal(curriculumProgress(lesson,p),0);
  const values:number[]=[];
  p.phase="vocabulary";values.push(curriculumProgress(lesson,p));
  p.phase="frame";for(const step of grammarSteps(lesson.curriculum!)){p.grammarStepId=step.id;values.push(curriculumProgress(lesson,p));}
  if(lesson.curriculum!.pronunciation!==false){p.phase="baseline";values.push(curriculumProgress(lesson,p));}
  p.phase="prepare";values.push(curriculumProgress(lesson,p));
  p.phase="chat";values.push(curriculumProgress(lesson,p));p.selectedDrinkId=lesson.chat.expectedChoiceId!;values.push(curriculumProgress(lesson,p));
  if(lesson.curriculum!.discussion){assert.ok(curriculumProgress(lesson,p)>=90);p.phase="discussion";values.push(curriculumProgress(lesson,p));p.discussionReplyId=lesson.curriculum!.discussion.expectedChoiceId!;values.push(curriculumProgress(lesson,p));}
  assert.ok(curriculumProgress(lesson,p)>=97);assert.ok(curriculumProgress(lesson,p)<100);
  p.phase="revisit";values.push(curriculumProgress(lesson,p));p.phase="note";values.push(curriculumProgress(lesson,p));
  p.phase="complete";values.push(curriculumProgress(lesson,p));assert.equal(curriculumProgress(lesson,p),100);
  values.forEach((value,index)=>{assert.ok(value>=0&&value<=100);if(index)assert.ok(value>=values[index-1],`${values}`);});
 }
});
