import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState, parseFirstLesson } from "../../lib/onboarding/personalized/flow";
import { updatedFirstLesson } from "../../lib/onboarding/personalized/firstLesson/curriculum";
import { grammarSteps, grammarStepIndex } from "../../lib/onboarding/personalized/firstLesson/grammarSequence";
import { GOALS } from "../../lib/onboarding/personalized/goals";

const normalize = (s: string) => s.replace(/[，。！？、\s]/g, "");
test("every concept is taught before its own objective assessment for every goal and level", () => {
  const formats = new Set<string>();
  for (const level of ["new", "few_words", "simple_sentences", "basic_conversations", "familiar_topics", "complex_topics"] as const) for (const goal of GOALS) {
    const a = initialState(new Date(), "test").answers;
    a.level.selfReport = level; a.goal.primary = goal.key;
    const curriculum = updatedFirstLesson(a)!.curriculum!;
    const steps = grammarSteps(curriculum);
    assert.equal(new Set(steps.map(s => s.id)).size, steps.length);
    for (let i = 0; i < curriculum.cards.length * 2; i += 2) {
      const teach = steps[i], check = steps[i + 1];
      assert.equal(teach.kind, "teach"); assert.equal(check.kind, "check");
      if (teach.kind !== "teach" || check.kind !== "check") throw new Error("Missing teaching/check pair");
      assert.equal(teach.card.id, check.card.id);
      formats.add(teach.card.format);
      assert.equal(check.practice.kind, "choice");
      if (check.practice.kind === "choice") {
        assert.ok(check.practice.correct);
        const correct=check.practice.correct;
        assert.equal(check.practice.choices.filter(p => p.id === correct).length, 1);
      }
      for (const e of teach.card.examples) {
        assert.ok(e.meaning && e.pinyin && e.label);
        if (e.parts) assert.equal(e.parts.map(p => p.hanzi).join(""), normalize(e.hanzi));
        if (e.highlight) { assert.ok(e.hanzi.includes(e.highlight.hanzi)); assert.ok(e.pinyin.includes(e.highlight.pinyin)); }
      }
    }
  }
  assert.deepEqual(Array.from(formats).sort(), ["contrast", "exchange", "pattern"]);
});
test("stable checkpoints survive parsing and old or removed checkpoints restart teaching", () => {
  const a = initialState(new Date(), "test").answers; a.level.selfReport = "few_words"; a.goal.primary = "work";
  const steps = grammarSteps(updatedFirstLesson(a)!.curriculum!);
  const saved = parseFirstLesson({ version: 2, phase: "frame", grammarStepId: "ability-question:check", grammarIndex: 5 });
  assert.equal(steps[grammarStepIndex(steps, saved.grammarStepId)].id, "ability-question:check");
  assert.equal(grammarStepIndex(steps, undefined), 0);
  assert.equal(grammarStepIndex(steps, "removed:teach"), 0);
  assert.equal(parseFirstLesson({ grammarStepId: "<script>" }).grammarStepId, undefined);
});
test("third-level supporting words are confirmed rather than expanding the teaching target", () => {
 const a=initialState(new Date(),"test").answers;a.level.selfReport="simple_sentences";a.goal.primary="travel";
 const lesson=updatedFirstLesson(a)!;
 for(const word of ["我","你","不","吗","能"])assert.ok(lesson.match.some(w=>w.id===word));
 for(const word of ["说","中文","今天","现在","会"])assert.ok(!lesson.match.some(w=>w.id===word));
 assert.equal(lesson.curriculum!.cards.length,1);
});
