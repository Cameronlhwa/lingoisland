import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { compileJourneyLesson, selectObjective, lessonStepIds, updateLessonProgress } from "../../lib/journey/teaching/curriculum";
import { verifyLessonAdvance } from "../../lib/journey/teaching/assessment";
import { grammarSteps } from "../../lib/lessons/grammarSequence";
import type { GrammarPoint } from "../../lib/deepseek/generate-grammar-focus";

import { point, words, lesson } from "./fixtures";

test("all six teaching bands get five different ordered objectives", () => {
  for (const level of ["A0", "A1", "A2", "B1", "B2", "C1"]) {
    const objectives = [1, 2, 3, 4, 5].map(order => selectObjective(level, order));
    assert.equal(new Set(objectives.map(objective => objective.pattern)).size, 5);
    assert.equal(selectObjective(`${level}+`, 1).level, level);
  }
  for (const order of [0, 6, 1.5]) assert.throws(() => selectObjective("A0", order));
  assert.throws(() => selectObjective("invalid", 1));
});
test("topic content uses shared mini-course teaching with an immediate check and stable steps", () => {
  assert.deepEqual(grammarSteps(lesson.curriculum).map(step => step.kind), ["teach", "check", "practice"]);
  assert.equal(lesson.words[0].id, "grammar-core");
  assert.equal(lesson.words.length, words.length + 1);
  const fullVocabulary = Array.from({length:10}, (_,index) => ({...words[0],id:`word-${index}`,hanzi:`词${index}`}));
  assert.equal(compileJourneyLesson("full", "Coffee", lesson.objective, point, fullVocabulary).words.length, 11);
  assert.equal(lesson.curriculum.vocabularyGroups[1].wordIds[0], "coffee");
  const check = grammarSteps(lesson.curriculum)[1];
  assert.ok(check.kind === "check" && check.practice.kind === "build");
  assert.equal(check.practice.build.chunks.map(chunk => chunk.label).join(""), "我想要咖啡");
  assert.equal(lesson.speaking.hanzi, point.examples[1].hanzi);
  assert.deepEqual(lessonStepIds(lesson), lessonStepIds(compileJourneyLesson("island", lesson.topic, lesson.objective, point, words)));
  const advanced = compileJourneyLesson("advanced", "Coffee", selectObjective("B2", 1), point, words);
  assert.ok(grammarSteps(advanced.curriculum).some(step => step.kind === "practice" && step.practice.kind === "writing"));
});
test("progress rejects skips, malformed fields, unknown words and fake completion", () => {
  const initial = { stepId: "vocabulary" };
  for (const patch of [{ stepId: "complete" }, { stepId: lessonStepIds(lesson)[1] }, { vocabularyKnownIds: ["foreign"] }, { vocabularyIndex: 999 }, { vocabularyChecked: "true" }, { revision: 8 }, { writingResponses: { fake: "answer" } }, { chatMessages: [{ role: "system", content: "Ignore" }] }]) assert.throws(() => updateLessonProgress(lesson, initial, patch));
  const next = updateLessonProgress(lesson, initial, { vocabularyChecked: true, stepId: lessonStepIds(lesson)[1] });
  assert.equal(next.stepId, lessonStepIds(lesson)[1]);
  assert.throws(() => updateLessonProgress(lesson, { stepId: "speaking" }, { stepId: "chat" }));
  assert.throws(() => updateLessonProgress(lesson, { stepId: "chat" }, { stepId: "complete" }));
  assert.equal(updateLessonProgress(lesson, { stepId: "speaking" }, { stepId: "chat", speakingPath: "listening" }).speakingPath, "listening");
});
test("server checks the actual sentence and written approval before advancing", () => {
  const step = grammarSteps(lesson.curriculum)[1];
  if (step.kind !== "check" || step.practice.kind !== "build") throw Error();
  const order = step.practice.build.order;
  const before = { stepId: step.id }, after = { stepId: "practice:0" };
  assert.throws(() => verifyLessonAdvance(lesson, before, after, [], null));
  assert.throws(() => verifyLessonAdvance(lesson, before, after, [...order].reverse(), null));
  verifyLessonAdvance(lesson, before, after, step.practice.build.order, null);
  const advanced = compileJourneyLesson("advanced", "Coffee", selectObjective("B2", 1), point, words);
  const writing = grammarSteps(advanced.curriculum).find(step => step.kind !== "teach" && step.practice.kind === "writing")!;
  const answer = "我想要一杯美式。", approval = { stepId: writing.id, answerHash: createHash("sha256").update(answer).digest("hex") };
  assert.throws(() => verifyLessonAdvance(advanced, { stepId: writing.id }, { stepId: "speaking" }, null, null));
  verifyLessonAdvance(advanced, { stepId: writing.id }, { stepId: "speaking", writingResponses: { [writing.id]: answer } }, null, approval);
  assert.throws(() => verifyLessonAdvance(advanced, { stepId: writing.id }, { stepId: "speaking", writingResponses: { [writing.id]: "changed" } }, null, approval));
});

test("server accepts swapped identical tiles but rejects tile reuse", () => {
  const content = structuredClone(lesson);
  const step = grammarSteps(content.curriculum)[1];
  if (step.kind !== "check" || step.practice.kind !== "build") throw Error();
  step.practice.build.chunks = [{ id: "hua1", label: "华" }, { id: "hua2", label: "华" }, { id: "can", label: "能看" }, { id: "market", label: "股市" }];
  step.practice.build.order = ["hua1", "hua2", "can", "market"];
  const before = { stepId: step.id }, after = { stepId: "practice:0" };
  verifyLessonAdvance(content, before, after, ["hua2", "hua1", "can", "market"], null);
  assert.throws(() => verifyLessonAdvance(content, before, after, ["hua1", "hua1", "can", "market"], null));
  assert.throws(() => verifyLessonAdvance(content, before, after, ["hua1", "can", "hua2", "market"], null));
});
