import assert from "node:assert/strict";
import { test } from "node:test";
import { VOCAB_BANK, wordsForScreen, VOCAB_COUNT_DESKTOP, VOCAB_COUNT_MOBILE } from "../../lib/onboarding/personalized/vocabRecognition";
import { GOALS } from "../../lib/onboarding/personalized/goals";

test("assessment pools are fixed across viewports and interests, with stable shuffled presentation", () => {
  assert.equal(VOCAB_COUNT_DESKTOP,15); assert.equal(VOCAB_COUNT_MOBILE,15);
  for (const goal of GOALS) for (const band of ["basic","advanced"] as const) for (const count of [14,15,16]) {
    const words=wordsForScreen(band,goal.key,[],"seed",count);
    assert.equal(words.length,15);
    assert.deepEqual(words,wordsForScreen(band,goal.key,["finance","food"],"seed",count));
    const other=wordsForScreen(band,goal.key,[],"other-seed",count);
    assert.deepEqual(new Set(words.map(word=>word.id)),new Set(other.map(word=>word.id)));
  }
  assert.equal(new Set(VOCAB_BANK.map(word=>word.id)).size,VOCAB_BANK.length);
});
