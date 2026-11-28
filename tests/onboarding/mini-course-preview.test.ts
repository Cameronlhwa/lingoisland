import { test } from "node:test";
import assert from "node:assert/strict";
import { canVisit, parseState, resumeStep } from "../../lib/onboarding/personalized/flow";
import { GOALS } from "../../lib/onboarding/personalized/goals";
import { updatedFirstLesson } from "../../lib/onboarding/personalized/firstLesson/curriculum";
import { MINI_COURSE_PREVIEWS, miniCoursePreview } from "../../lib/testing/miniCoursePreview";

test("every mini-course shortcut survives storage parsing and resumes directly at the selected course",()=>{
 for(const [index,course] of Array.from(MINI_COURSE_PREVIEWS.entries()))for(const goal of GOALS){
  const original=miniCoursePreview(course.level,goal.key,new Date("2026-11-20T12:00:00Z"));
  const state=parseState(JSON.parse(JSON.stringify(original)))!;
  assert.ok(state);assert.equal(state.answers.onboardingVariant,"test");
  assert.equal(resumeStep(state, true),"first_lesson");assert.ok(canVisit("first_lesson",state, true));
  const lesson=updatedFirstLesson(state.answers)!;assert.equal(lesson.template!.tier,index+1);assert.equal(lesson.id,`${index<3?"budget-v1":"methods-v1"}-${index+1}-${goal.key}-0`);
  assert.equal(state.answers.firstLesson.phase,"intro");assert.deepEqual(state.answers.firstLesson.xpAwarded,[]);
  assert.equal(state.answers.firstLesson.completedAt,null);assert.equal(state.answers.firstLesson.vocabularyChecked,false);
  assert.equal(state.answers.commitment.committedAt,null);assert.equal(state.revision,null);
 }
});
test("starting another preview is fresh and cannot inherit drafts or completed lesson state",()=>{
 const previous=miniCoursePreview("complex_topics","work");previous.answers.firstLesson.writingResponses={"practice:1":"我的看法。"};previous.answers.firstLesson.xpAwarded=["meaning","build"];previous.answers.firstLesson.phase="chat";
 const fresh=miniCoursePreview("new","heritage");assert.equal(fresh.answers.firstLesson.writingResponses,undefined);assert.deepEqual(fresh.answers.firstLesson.xpAwarded,[]);assert.equal(fresh.answers.firstLesson.phase,"intro");
});
