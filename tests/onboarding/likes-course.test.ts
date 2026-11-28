import assert from "node:assert/strict";
import {test} from "node:test";
import {GOALS} from "../../lib/onboarding/personalized/goals";
import {FIRST_LEVEL_TEST_FLAG,firstLevelVariant} from "../../lib/onboarding/personalized/experiment";
import {initialState,parseAnswers,parseFirstLesson,stepsFor} from "../../lib/onboarding/personalized/flow";
import {makeBudgetCourse} from "../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
import {updatedFirstLesson,isUpdatedPronunciationTarget} from "../../lib/onboarding/personalized/firstLesson/curriculum";
import {beginPlacement,recordWordCheck,placementAssessmentWords,parseCoursePlacement,finishGrammarProbe} from "../../lib/onboarding/personalized/firstLesson/coursePlacement";
import {grammarSteps} from "../../lib/lessons/grammarSequence";
import {curriculumProgress} from "../../lib/onboarding/personalized/firstLesson/lessonProgress";
import {wordsForScreen,suggestedCourseFromVocab,isCurrentVocabScreen,courseMarkersForVariant} from "../../lib/onboarding/personalized/vocabRecognition";
import {miniCoursePreview} from "../../lib/testing/miniCoursePreview";
import {previewStorageKey} from "../../lib/testing/config";

test("first-level-test is independent and only explicit test enables the new lesson",()=>{
 assert.equal(FIRST_LEVEL_TEST_FLAG,"first-level-test");
 for(const value of [undefined,null,false,true,"control","unexpected",{}])assert.equal(firstLevelVariant(value),"control");
 assert.equal(firstLevelVariant("test"),"test");
 const a=miniCoursePreview("new","work").answers;
 assert.match(updatedFirstLesson(a)!.id,/^budget-v1-1/);
 a.firstLevelVariant="test";assert.match(updatedFirstLesson(a)!.id,/^likes-v1-1/);
 a.onboardingVariant="control";assert.equal(stepsFor(a).includes("first_lesson"),false);
 a.onboardingVariant="test";assert.equal(stepsFor(a).includes("first_lesson"),true);
 assert.notEqual(previewStorageKey("test"),previewStorageKey("control"));
});

test("every goal and content variant teaches likes, the dedicated ma page, and both conversation turns",()=>{
 for(const goal of GOALS)for(const variant of [0,1]){
  const a=miniCoursePreview("new",goal.key,new Date(),"test").answers;
  const lesson=makeBudgetCourse(1,goal.key,variant,a);
  assert.equal(lesson.match.length,6);
  assert.equal(new Set(lesson.match.map(w=>w.hanzi)).size,6);
  for(const word of ["我","你","喜欢","吗"])assert.ok(lesson.match.some(w=>w.hanzi===word));
  const steps=grammarSteps(lesson.curriculum!);
  assert.deepEqual(steps.map(step=>step.id),["likes-statement:teach","likes-statement:check","likes-question:teach","likes-ma:teach","likes-ma:check","practice:0","practice:1"]);
  const ma=lesson.curriculum!.cards[2];assert.match(ma.explanation,/question particle/);assert.equal(ma.examples.length,2);
  assert.ok(ma.examples[0].hanzi.endsWith("。"));assert.ok(ma.examples[1].hanzi.endsWith("吗？"));
  for(const build of [lesson.build,lesson.transferBuild]){
   assert.equal(build.order.map(id=>build.chunks.find(c=>c.id===id)!.label).join(""),build.result.hanzi.replace(/[。？]/g,""));
   assert.ok(isUpdatedPronunciationTarget(build.result.hanzi));
  }
  assert.ok(lesson.chat.huahua.hanzi.endsWith("吗？"));
  const follow=lesson.curriculum!.followUp!;
  assert.ok(follow.choices.find(p=>p.id===follow.expectedChoiceId)!.hanzi.endsWith("吗？"));
  assert.ok(follow.responses[follow.expectedChoiceId!]);
  assert.equal(lesson.curriculum!.afterChat!.cards[0].examples[1].hanzi,"喜欢吗？");
  for(const tier of [2,3,4,5,6] as const){
   const control=makeBudgetCourse(tier,goal.key,variant,{...a,firstLevelVariant:"control"});
   assert.deepEqual(makeBudgetCourse(tier,goal.key,variant,a),control);
  }
 }
});

test("likes placement checks use statements and questions and survive parsing with the same assignment",()=>{
 const a=miniCoursePreview("new","everyday",new Date(),"test").answers;
 const course=makeBudgetCourse(1,"everyday",0,a);
 assert.ok(course.budget.probes.every(probe=>probe.choices.every(c=>!c.hanzi.includes("你好"))));
 let p=recordWordCheck(beginPlacement(1,"everyday",{},"test"),[]);
 assert.equal(p.status,"ready");assert.equal(p.firstLevelVariant,"test");
 p=parseCoursePlacement(JSON.parse(JSON.stringify(p)))!;
 assert.equal(p.firstLevelVariant,"test");assert.equal(p.status,"ready");
 a.firstLesson.coursePlacement=p;
 assert.match(updatedFirstLesson(parseAnswers(a))!.id,/^likes-v1/);
 const known=placementAssessmentWords(course).map(w=>w.id);
 p=recordWordCheck(beginPlacement(1,"everyday",{},"test"),known);assert.equal(p.status,"probe");
 p=finishGrammarProbe(p,true);assert.equal(p.tier,2);assert.equal(p.firstLevelVariant,"test");
});

test("test assessment swaps 大家 for 喜欢 without changing the five-word HSK quotas",()=>{
 for(const goal of GOALS){
  const basic=wordsForScreen("basic",goal.key,[],"seed",15,"test");
  const advanced=wordsForScreen("advanced",goal.key,[],"seed",15,"test");
  const all=[...basic,...advanced];
  assert.equal(all.length,30);assert.equal(new Set(all.map(w=>w.hanzi)).size,30);
  for(let level=1;level<=6;level++)assert.equal(all.filter(w=>w.hsk===level).length,5);
  assert.ok(basic.some(w=>w.hanzi==="喜欢"));assert.ok(!all.some(w=>w.hanzi==="大家"));
  for(const marker of courseMarkersForVariant("test"))assert.ok(all.some(w=>w.hanzi===marker));
  const screen={assessmentVersion:2 as const,shownIds:basic.map(w=>w.id),selectedIds:basic.filter(w=>w.hanzi==="喜欢").map(w=>w.id),noneKnown:false};
  const empty={assessmentVersion:2 as const,shownIds:advanced.map(w=>w.id),selectedIds:[],noneKnown:true};
  assert.equal(isCurrentVocabScreen("basic",goal.key,screen,"test"),true);
  assert.equal(isCurrentVocabScreen("basic",goal.key,screen,"control"),false);
  assert.equal(suggestedCourseFromVocab(screen,empty,"test"),2);
 }
});

test("second conversation and short-question checkpoints survive refresh and contribute to progress",()=>{
 const a=miniCoursePreview("new","everyday",new Date(),"test").answers;
 const lesson=updatedFirstLesson(a)!;
 a.firstLesson={...a.firstLesson,lessonId:lesson.id,phase:"follow_up",selectedDrinkId:lesson.chat.expectedChoiceId!,followUpReplyId:lesson.curriculum!.followUp!.expectedChoiceId!};
 assert.equal(parseAnswers(a).firstLevelVariant,"test");
 assert.equal(parseFirstLesson(a.firstLesson).followUpReplyId,a.firstLesson.followUpReplyId);
 const chat=curriculumProgress(lesson,{...a.firstLesson,phase:"chat"});
 const follow=curriculumProgress(lesson,a.firstLesson);
 const short=curriculumProgress(lesson,{...a.firstLesson,phase:"short_question"});
 assert.ok(chat<follow);assert.ok(follow<=short);
 const saved=parseFirstLesson({...a.firstLesson,phase:"short_question",afterChatStepId:"likes-short-question:check",shortQuestionComplete:true});
 assert.equal(saved.phase,"short_question");assert.equal(saved.afterChatStepId,"likes-short-question:check");assert.equal(saved.shortQuestionComplete,true);
 assert.equal(curriculumProgress(lesson,{...saved,phase:"complete"}),100);
 const old=initialState(new Date()).answers;assert.equal(parseAnswers(old).firstLevelVariant,undefined);
});
