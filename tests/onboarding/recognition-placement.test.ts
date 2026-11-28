import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { GOALS } from "../../lib/onboarding/personalized/goals";
import { initialState, parseAnswers, updateAnswers, provisionalLevel, stepsFor, resumeStep } from "../../lib/onboarding/personalized/flow";
import { updatedLessonLevel } from "../../lib/onboarding/personalized/firstLesson/curriculum";
import { miniCoursePreview, MINI_COURSE_PREVIEWS } from "../../lib/testing/miniCoursePreview";
import { ASSESSMENT_VOCAB, COURSE_MARKERS, SUBJECT_VOCAB, wordsForScreen, estimateLevelFromVocab, suggestedCourseFromVocab, hasCurrentVocabAssessment, isCurrentVocabScreen, parseVocabScreen, type VocabWord, type VocabScreenAnswer } from "../../lib/onboarding/personalized/vocabRecognition";

const pool = [...wordsForScreen("basic", "work", [], "test"), ...wordsForScreen("advanced", "work", [], "test")];
function answers(selected: readonly VocabWord[] = [], goal: typeof GOALS[number]["key"] = "work") {
  const known = new Set(selected.map(word => word.id));
  const screen = (band: "basic" | "advanced"): VocabScreenAnswer => {
    const shownIds = wordsForScreen(band, goal, [], "test").map(word => word.id);
    const selectedIds = shownIds.filter(id => known.has(id));
    return { assessmentVersion: 2, shownIds, selectedIds, noneKnown: selectedIds.length === 0 };
  };
  return { basic: screen("basic"), advanced: screen("advanced") };
}

test("all categories have 30 unique words, five per HSK level, two subject words per level, and all six markers", () => {
  const reference = JSON.parse(readFileSync(new URL("../../data/hsk-vocabulary-2.0.json", import.meta.url), "utf8"));
  const official = new Map(reference.words.map((word: {hanzi:string;level:number}) => [word.hanzi,word.level]));
  for (const word of ASSESSMENT_VOCAB) assert.equal(word.hsk,official.get(word.hanzi),word.hanzi);
  for (const goal of GOALS) for (const seed of ["a", "b", "c"]) {
    const basic = wordsForScreen("basic", goal.key, [], seed);
    const advanced = wordsForScreen("advanced", goal.key, [], seed);
    const all = [...basic,...advanced];
    assert.equal(basic.length,15); assert.equal(advanced.length,15);
    assert.equal(new Set(all.map(word=>word.hanzi)).size,30);
    for (let level=1;level<=6;level++) {
      const group=all.filter(word=>word.hsk===level);
      assert.equal(group.length,5);
      assert.equal(group.filter(word=>SUBJECT_VOCAB[goal.key][level-1].includes(word.hanzi)).length,2);
    }
    for (const marker of COURSE_MARKERS) assert.equal(all.filter(word=>word.hanzi===marker).length,1);
    assert.deepEqual(basic,wordsForScreen("basic",goal.key,["finance"],seed,14));
  }
});

test("every total-count boundary uses four-word ranges and ignores self-report after the assessment", () => {
  for(let count=0;count<=30;count++) {
    const candidate=Math.min(6,Math.ceil(count/4));
    const atLevel=pool.filter(word=>word.hsk===candidate).slice(0,Math.min(3,count));
    const selected=[...atLevel,...pool.filter(word=>!atLevel.includes(word)).slice(0,count-atLevel.length)];
    const screens=answers(selected);
    for(const selfReport of ["new","few_words","complex_topics"] as const) assert.equal(estimateLevelFromVocab({selfReport,...screens}),candidate,`${count}:${selfReport}`);
  }
});

test("advanced placement requires three recognized words at that level, stepping down through unsupported levels", () => {
  const lower=pool.filter(word=>word.hsk<=4);
  const weak=answers([...lower,...pool.filter(word=>word.hsk===5).slice(0,1)]);
  assert.equal(estimateLevelFromVocab({selfReport:"complex_topics",...weak}),4);
  const supported=answers([...lower.slice(0,18),...pool.filter(word=>word.hsk===5).slice(0,3),...pool.filter(word=>word.hsk===6).slice(0,1)]);
  assert.equal(estimateLevelFromVocab({selfReport:"new",...supported}),5);
});

test("all marker combinations recommend the next course independently of level and self-report", () => {
  for(let mask=0;mask<64;mask++) {
    const selectedMarkers=COURSE_MARKERS.filter((_,i)=>(mask & (1<<i))!==0);
    const selected=pool.filter(word=>selectedMarkers.includes(word.hanzi as typeof COURSE_MARKERS[number]));
    const highest=COURSE_MARKERS.reduce((n,marker,index)=>selectedMarkers.includes(marker)?index+1:n,0);
    const expected=Math.min(6,highest+1);
    for(const extras of [[],pool.filter(word=>!COURSE_MARKERS.includes(word.hanzi as typeof COURSE_MARKERS[number]))]) {
      const screens=answers([...selected,...extras]);
      assert.equal(suggestedCourseFromVocab(screens.basic,screens.advanced),expected);
      for(const selfReport of ["new","complex_topics"] as const) {
        const a=initialState(new Date(),"test").answers;
        a.level.selfReport=selfReport;a.goal.primary="work";a.vocabBasic=screens.basic;a.vocabAdvanced=screens.advanced;
        a.estimatedLevel=6;assert.equal(updatedLessonLevel(a),expected);
        a.estimatedLevel=0;assert.equal(updatedLessonLevel(a),expected);
      }
    }
  }
});

test("deduplicates picks and ignores unshown, skipped and none-known selections", () => {
  const screens=answers(pool);
  const repeated=parseVocabScreen({...screens.basic,shownIds:[...screens.basic.shownIds,...screens.basic.shownIds],selectedIds:[...screens.basic.selectedIds,...screens.basic.selectedIds,"bad"]});
  assert.equal(repeated.shownIds.length,15);assert.equal(repeated.selectedIds.length,15);
  const none=answers();
  assert.equal(suggestedCourseFromVocab({...none.basic,selectedIds:screens.basic.selectedIds},none.advanced),1);
  assert.equal(estimateLevelFromVocab({selfReport:"complex_topics",basic:{...screens.basic,skipped:true},advanced:{...screens.advanced,skipped:true}}),0);
});

test("only completed versioned assessments trigger the marker rule; direct testing shortcuts retain their course", () => {
  const screens=answers(pool);
  assert.equal(hasCurrentVocabAssessment({...screens.basic,selectedIds:[],noneKnown:false},screens.advanced),false);
  assert.equal(hasCurrentVocabAssessment({...screens.basic,assessmentVersion:undefined},screens.advanced),false);
  for(const [i,course] of Array.from(MINI_COURSE_PREVIEWS.entries())) for(const goal of GOALS) assert.equal(updatedLessonLevel(parseAnswers(miniCoursePreview(course.level,goal.key).answers)),i+1);
});

test("versioned progress survives reload, re-scores on the server, and invalidates when the subject changes", () => {
  const now=new Date();let state=initialState(now,"test");state.answers.goal.primary="work";state.answers.level.selfReport="new";
  const screens=answers(pool);
  state=updateAnswers(state,{vocabBasic:screens.basic},now);assert.equal(state.answers.estimatedLevel,null);
  state=updateAnswers(state,{vocabAdvanced:screens.advanced},now);assert.equal(state.answers.estimatedLevel,6);
  const saved=parseAnswers(JSON.parse(JSON.stringify({...state.answers,estimatedLevel:0})));
  assert.equal(saved.estimatedLevel,6);assert.equal(provisionalLevel(saved),6);assert.equal(updatedLessonLevel(saved),6);
  assert.equal(isCurrentVocabScreen("basic","work",saved.vocabBasic),true);
  assert.equal(isCurrentVocabScreen("basic","school",saved.vocabBasic),false);
  const invalid=parseAnswers({...saved,goal:{...saved.goal,primary:"school"}});assert.equal(invalid.estimatedLevel,null);assert.equal(invalid.vocabBasic.shownIds.length,0);
  state=updateAnswers(state,{goal:{primary:"travel",secondary:null,otherText:null}},now);
  assert.equal(state.answers.estimatedLevel,null);assert.equal(state.answers.vocabBasic.shownIds.length,0);
});

 test("mini-course test assignments and private previews both include the lesson", () => {
  const state=miniCoursePreview("familiar_topics","work");
  assert.equal(stepsFor(state.answers).includes("first_lesson"),true);
  assert.equal(stepsFor(state.answers,true).includes("first_lesson"),true);
  assert.equal(resumeStep(state,true),"first_lesson");
  state.answers.onboardingVariant="control";
  assert.equal(stepsFor(state.answers,true).includes("first_lesson"),false);
});
