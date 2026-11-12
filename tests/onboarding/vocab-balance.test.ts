import assert from "node:assert/strict";
import { test } from "node:test";
import { VOCAB_BANK, wordsForScreen } from "../../lib/onboarding/personalized/vocabRecognition";
import type { GoalKey } from "../../lib/onboarding/personalized/goals";

test("topic words stay within a quarter budget while general words span all three levels", () => {
  const profiles: [GoalKey, string[]][] = [["work", ["meetings", "finance"]], ["travel", ["restaurants", "hotels"]], ["school", ["presentations"]], ["everyday", ["hobbies", "food"]], ["heritage", ["traditions"]]];
  for (const [goal, interests] of profiles) for (const band of ["basic", "advanced"] as const) for (const count of [14, 15, 16]) for (let seed = 0; seed < 10; seed++) {
    const words = wordsForScreen(band, goal, interests, `${seed}`, count);
    const relevant = (word: typeof words[number]) => Boolean(word.goals?.includes(goal) || word.interests?.some(key => interests.includes(key)));
    assert.equal(words.length, count);
    assert.equal(new Set(words.map(word => word.id)).size, count);
    assert.ok(words.filter(relevant).length <= Math.round(count / 4));
    const general = words.filter(word => !relevant(word));
    assert.ok(general.every(word => word.diagnostic));
    assert.equal(new Set(general.map(word => word.hsk)).size, 3);
    assert.deepEqual(words, wordsForScreen(band, goal, interests, `${seed}`, count));
  }
  assert.equal(new Set(VOCAB_BANK.map(word => word.id)).size, VOCAB_BANK.length);
});
