import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { generateGrammarFocus } from "../../lib/deepseek/generate-grammar-focus";
import { lessonBody } from "../../lib/journey/teaching/http";
import { limitLessonRequests } from "../../lib/journey/teaching/rateLimit";
import { point } from "./fixtures";

test("generation pins the planned grammar and refuses an unrelated response", async () => {
  const previous = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-only";
  let payload: any;
  const stub = mock.method(globalThis, "fetch", async (_input: unknown, init: RequestInit) => {
    payload = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ points: [point] }) } }] }));
  });
  try {
    const result = await generateGrammarFocus({ topic: "Coffee", level: "A1", detailedLevel: "A0", grammarCount: 1, requiredPattern: "想要", supportingWords: ["咖啡", "美式"] });
    assert.equal(result.points[0].hanzi, "想要");
    assert.match(payload.messages[1].content, /ASSIGNED LESSON OBJECTIVE/);
    assert.match(payload.messages[1].content, /咖啡/);
    assert.match(payload.messages[1].content, /At A0/);
    const unrelated = await generateGrammarFocus({ topic: "Coffee", level: "B1", grammarCount: 1, requiredPattern: "虽然…但是…" });
    assert.deepEqual(unrelated.points, []);
  } finally {
    stub.mock.restore();
    if (previous === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = previous;
  }
});
test("lesson mutations reject foreign origins, oversized bodies and invalid JSON", async () => {
  const request = (body: string, origin = "http://localhost:3002") => new Request("http://localhost:3002/api/test", { method: "PATCH", headers: { origin, "Content-Type": "application/json" }, body });
  await assert.rejects(() => lessonBody(request("{}", "https://foreign.example")), /Forbidden/);
  await assert.rejects(() => lessonBody(request("{}".repeat(5000)), 100), /Request too large/);
  for (const body of ["not json", "[]", "null"]) await assert.rejects(() => lessonBody(request(body)), /Invalid request/);
  assert.deepEqual(await lessonBody(request('{"revision":2}')), { revision: 2 });
});
test("provider rate limits are scoped to a learner and action and expire", () => {
  const now = 1000;
  limitLessonRequests("learner-a", "generation-test", 1, now);
  assert.throws(() => limitLessonRequests("learner-a", "generation-test", 1, now), /wait a moment/);
  limitLessonRequests("learner-b", "generation-test", 1, now);
  limitLessonRequests("learner-a", "writing-test", 1, now);
  limitLessonRequests("learner-a", "generation-test", 1, now + 60001);
});
