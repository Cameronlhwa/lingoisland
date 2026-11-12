import {test} from "node:test";
import assert from "node:assert/strict";
import {onboardingVariant,MINI_LESSON_ONBOARDING_FLAG} from "../../lib/onboarding/personalized/experiment";
import {initialState,emptyAnswers,stepsFor,parseState,parseAnswers,provisionalLevel,nextStep,canVisit} from "../../lib/onboarding/personalized/flow";
import {sanitizeOnboardingProps} from "../../lib/onboarding/personalized/analytics";
test("only explicit test selects mini-lesson onboarding",()=>{
 assert.equal(MINI_LESSON_ONBOARDING_FLAG,"mini-lesson-onboarding");
 for(const flag of [undefined,null,false,true,"control","enabled","unexpected",1,{}])assert.equal(onboardingVariant(flag),"control");
 assert.equal(onboardingVariant("test"),"test");
});
test("flag-off default preserves the production learner sequence",()=>{
 const a=emptyAnswers();a.level.selfReport="few_words";
 assert.deepEqual(stepsFor(a),["goal","interests","level","experience","using_pain","learning_pain","reviews","calibration","pronunciation","availability","building","reflect","commitment","paywall"]);
 assert.equal(nextStep("level",a),"experience");assert.equal(nextStep("reflect",a),"commitment");
});
test("control beginners skip experience and calibration but keep production pronunciation",()=>{
 const a=emptyAnswers();a.level.selfReport="new";
 assert.deepEqual(stepsFor(a),["goal","interests","level","using_pain","learning_pain","reviews","pronunciation","availability","building","reflect","commitment","paywall"]);
 assert.equal(canVisit("first_lesson",initialState(new Date())),false);
});
test("test includes vocabulary screens and lesson, and excludes legacy checks",()=>{
 const a=emptyAnswers("test");a.level.selfReport="few_words";
 assert.equal(nextStep("level",a),"vocab_basic");assert.equal(nextStep("reflect",a),"first_lesson");
 for(const step of ["calibration","pronunciation"])assert.ok(!stepsFor(a).includes(step as never));
});
test("legacy saved progress defaults to control and explicit assignment survives storage",()=>{
 const old=initialState(new Date());const {onboardingVariant:ignored,...answers}=old.answers;
 assert.equal(parseState({...old,answers})?.answers.onboardingVariant,"control");
 assert.equal(parseAnswers({...answers,onboardingVariant:"invalid"}).onboardingVariant,"control");
 assert.equal(parseAnswers({...answers,onboardingVariant:"test"}).onboardingVariant,"test");
});
test("control ignores vocabulary estimates retained from a previous test assignment",()=>{
 const a=emptyAnswers();a.level.selfReport="few_words";a.estimatedLevel=5;
 assert.notEqual(provisionalLevel(a),5);a.onboardingVariant="test";assert.equal(provisionalLevel(a),5);
 assert.deepEqual(sanitizeOnboardingProps({onboarding_variant:"test","$feature/mini-lesson-onboarding":"test",name:"private"}),{onboarding_variant:"test","$feature/mini-lesson-onboarding":"test"});
});
