import assert from "node:assert/strict";
import { test } from "node:test";
import { isCorrectBuildAnswer } from "../../lib/lessons/buildAnswer";

const prompt = {
  chunks: [{ id: "hua1", label: "华" }, { id: "hua2", label: "华" }, { id: "can", label: "能看" }, { id: "market", label: "股市" }],
  order: ["hua1", "hua2", "can", "market"],
};
test("identical character tiles can be swapped without changing the sentence", () => {
  assert.equal(isCorrectBuildAnswer(prompt, prompt.order), true);
  assert.equal(isCorrectBuildAnswer(prompt, ["hua2", "hua1", "can", "market"]), true);
});
test("identical phrase tiles can be swapped across separate sentence positions", () => {
  const phrases = { chunks: [{ id: "a", label: "咖啡" }, { id: "b", label: "还是" }, { id: "c", label: "咖啡" }], order: ["a", "b", "c"] };
  assert.equal(isCorrectBuildAnswer(phrases, ["c", "b", "a"]), true);
  assert.equal(isCorrectBuildAnswer(phrases, ["a", "c", "b"]), false);
});
test("wrong word order, reused tiles and malformed evidence remain invalid", () => {
  for (const answer of [null, "华华能看股市", {}, [1, 2, 3, 4], [], ["hua1", "can", "hua2", "market"], ["hua1", "hua1", "can", "market"], ["hua1", "hua2", "can"], [...prompt.order, "extra"], ["hua1", "foreign", "can", "market"]]) {
    assert.equal(isCorrectBuildAnswer(prompt, answer), false, JSON.stringify(answer));
  }
});
test("a same-label distractor cannot replace a required tile", () => {
  assert.equal(isCorrectBuildAnswer({ ...prompt, chunks: [...prompt.chunks, { id: "distractor", label: "华" }] }, ["distractor", "hua2", "can", "market"]), false);
});
