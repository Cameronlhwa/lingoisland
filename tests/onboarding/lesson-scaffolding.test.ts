import assert from "node:assert/strict";
import { test } from "node:test";
import { LESSON_BANK, isLessonPronunciationTarget } from "../../lib/onboarding/personalized/firstLesson/bank";
import { estimateLevelFromVocab } from "../../lib/onboarding/personalized/vocabRecognition";
import { parseFirstLesson, awardLessonXp, lessonXpTotal } from "../../lib/onboarding/personalized/flow";
import { EMPTY_FIRST_LESSON } from "../../lib/onboarding/personalized/firstLesson/types";

test("every authored mission has a practiced answer and explicit meanings for every chunk", () => {
  assert.equal(new Set(LESSON_BANK.map(l => l.id)).size, LESSON_BANK.length);
  for (const lesson of LESSON_BANK) {
    assert.equal(lesson.match.length, 2);
    assert.equal(lesson.questionWords.map(word => word.hanzi).join(""), lesson.chat.huahua.hanzi.replace(/[，。！？、]/g, ""), lesson.id);
    for (const word of lesson.questionWords) { assert.ok(word.pinyin); assert.ok(word.meaning); }
    for (const build of [lesson.build, lesson.transferBuild]) {
      for (const chunk of build.chunks) { assert.ok(chunk.meaning, lesson.id); assert.ok(chunk.pinyin, lesson.id); }
      const produced = build.order.map(id => build.chunks.find(c => c.id === id)!.label).join("");
      assert.equal(produced.replace(/[，。！？、]/g, ""), build.result.hanzi.replace(/[，。！？、]/g, ""), lesson.id);
    }
    const expected = lesson.chat.choices.find(p => p.id === lesson.chat.expectedChoiceId)!;
    assert.equal(expected.hanzi, lesson.transferBuild.result.hanzi);
    assert.ok(lesson.chat.responses[expected.id]);
    for (const target of [...lesson.targets, lesson.starter]) assert.ok(isLessonPronunciationTarget(target.hanzi.replace(/[，。！？、]/g, "")), target.hanzi);
  }
  assert.equal(isLessonPronunciationTarget("任意用户输入"), false);
});
test("a zero recognition result lowers an inflated claim; completely new stays beginner", () => {
  const empty = { shownIds: ["wo", "ni", "hao", "shi"], selectedIds: [], noneKnown: true };
  assert.equal(estimateLevelFromVocab({ selfReport: "complex_topics", basic: empty, advanced: empty }), 1);
  assert.equal(estimateLevelFromVocab({ selfReport: "new", basic: { ...empty, selectedIds: empty.shownIds, noneKnown: false }, advanced: { ...empty, selectedIds: empty.shownIds, noneKnown: false } }), 0);
});
test("new lesson phases and mistakes survive persistence, but recording URLs do not", () => {
  const progress = parseFirstLesson({ ...EMPTY_FIRST_LESSON, phase: "transfer", mistakes: ["cha"], baseline: { at: new Date().toISOString(), playbackUrl: "blob:private", feedback: "close", overall: 50, tone: 45 } });
  assert.equal(progress.phase, "transfer"); assert.equal(progress.version, 2); assert.deepEqual(progress.mistakes, ["cha"]);
  assert.equal(progress.baseline?.playbackUrl, null); assert.equal(progress.baseline?.overall, 50);
  let earned = progress;
  for (let i = 0; i < 2; i++) for (const key of ["meaning", "build", "speaking", "exchange"] as const) earned = awardLessonXp(earned, key);
  assert.equal(lessonXpTotal(earned), 50);
});
