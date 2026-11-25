import assert from "node:assert/strict";
import { test } from "node:test";
import { parseGuidedReply } from "../../lib/journey/teaching/chatReply";
import { updateLessonProgress } from "../../lib/journey/teaching/curriculum";
import { lesson } from "./fixtures";

test("guided replies retain a usable message and only bounded Mandarin suggestions", () => {
  assert.deepEqual(parseGuidedReply(JSON.stringify({ message: "  你想喝什么？ ", suggestions: ["咖啡", "咖啡", "  茶  ", null, "English only", "长".repeat(81), "水", "果汁"] })), { message: "你想喝什么？", suggestions: ["咖啡", "茶", "水"] });
  assert.deepEqual(parseGuidedReply("你好！"), { message: "你好！", suggestions: [] });
  assert.deepEqual(parseGuidedReply('```json\n{"message":"你好！","suggestions":[]}\n```'), { message: "你好！", suggestions: [] });
  assert.throws(() => parseGuidedReply('{"suggestions":["茶"]}'));
  assert.throws(() => parseGuidedReply('{"message":'));
});

test("reply suggestions survive progress saves without changing old conversations", () => {
  const messages = [{ role: "assistant" as const, content: "你想喝什么？", suggestions: ["咖啡", "茶"] }];
  assert.deepEqual(updateLessonProgress(lesson, { stepId: "chat" }, { chatMessages: messages }).chatMessages, messages);
  assert.doesNotThrow(() => updateLessonProgress(lesson, { stepId: "chat" }, { chatMessages: [{ role: "assistant", content: "你好！" }] }));
  for (const suggestions of [["长".repeat(81)], [1], "茶", ["茶", "水", "咖啡", "牛奶"]]) {
    assert.throws(() => updateLessonProgress(lesson, { stepId: "chat" }, { chatMessages: [{ role: "assistant", content: "你好！", suggestions }] }));
  }
  assert.throws(() => updateLessonProgress(lesson, { stepId: "chat" }, { chatMessages: [{ role: "user", content: "你好！", suggestions: ["茶"] }] }));
});

test("saved chat separates optional pinyin and reply hints without losing the message", async () => {
  const { conversationParts } = await import("../../lib/journey/teaching/chatReply");
  assert.deepEqual(conversationParts('你好！你更常用电脑还是手机 app？\n(Nǐ hǎo! Nǐ gèng cháng yòng diànnǎo háishi shǒujī app?)\nHint: answer “电脑” or “手机 app”.'), {
    message: "你好！你更常用电脑还是手机 app？", pinyin: "Nǐ hǎo! Nǐ gèng cháng yòng diànnǎo háishi shǒujī app?", suggestions: ["电脑", "手机 app"], hints: [],
  });
  assert.deepEqual(conversationParts("你好！(Nǐ hǎo!)"), { message: "你好！", pinyin: "Nǐ hǎo!", suggestions: [], hints: [] });
  assert.equal(conversationParts("你喜欢 Café 吗？\nCafé means coffee shop.").message, "你喜欢 Café 吗？\nCafé means coffee shop.");
  assert.deepEqual(conversationParts("你想喝什么？\nHint: Try using 想要."), { message: "你想喝什么？", hints: ["Try using 想要."], suggestions: [] });
});
