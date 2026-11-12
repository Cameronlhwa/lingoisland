import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState, parseFirstLesson } from "../../lib/onboarding/personalized/flow";
import { parseDraft, validateDraft, lessonEvidence, lessonInput, personalizationKey, personalizedLesson, uncertainWords, type LessonDraft } from "../../lib/onboarding/personalized/firstLesson/personalization";
import { generateLesson, lessonPrompt } from "../../lib/onboarding/personalized/firstLesson/model";
import { lessonToken, validLessonTarget } from "../../lib/onboarding/personalized/firstLesson/token";
function answers() {
 const a = initialState(new Date()).answers;
 a.goal.primary = "travel"; a.interests = { keys: ["restaurants"], custom: "PRIVATE CUSTOM INTEREST" }; a.level.selfReport = "simple_sentences";
 a.vocabBasic = { shownIds: ["wo", "ni", "shi", "hao", "cha", "kafei", "shui", "mingtian"], selectedIds: ["wo", "ni", "shi", "hao"], noneKnown: false };
 a.vocabAdvanced = { shownIds: [], selectedIds: [], noneKnown: false, skipped: true };
 a.commitment.name = "PRIVATE NAME";
 return a;
}
const w = (hanzi: string, pinyin: string, meaning: string) => ({ hanzi, pinyin, meaning });
export const draft: LessonDraft = {
 outcome: "Order a drink.", situation: "You are at a café.", mission: "Order coffee", completion: "You ordered coffee.", explanation: "Use 我要 before your drink.",
 targets: [w("茶", "chá", "tea"), w("咖啡", "kāfēi", "coffee")], prefix: [w("我", "wǒ", "I"), w("要", "yào", "want")], suffix: [],
 first: w("我要茶。", "Wǒ yào chá.", "I’d like tea."), second: w("我要咖啡。", "Wǒ yào kāfēi.", "I’d like coffee."),
 question: w("你要什么？", "Nǐ yào shénme?", "What would you like?"), questionWords: [w("你", "nǐ", "you"), w("要", "yào", "want"), w("什么", "shénme", "what")], response: w("好的！", "Hǎo de!", "Okay!"),
};
test("provider evidence distinguishes known, unfamiliar, skipped, and untested without private fields", () => {
 const a = answers(); const evidence = lessonEvidence(a);
 assert.equal(evidence.band, "elementary"); assert.ok(evidence.known.some(w => w.hanzi === "我")); assert.ok(evidence.unfamiliar.some(w => w.hanzi === "茶"));
 assert.ok(!JSON.stringify(lessonInput(a)).includes("PRIVATE")); assert.ok(!lessonPrompt(a, []).includes("PRIVATE"));
 assert.deepEqual(uncertainWords(draft, a).map(w => w.hanzi), ["要", "什么"]);
});
test("valid content converts into consistent exercises and survives persistence", () => {
 const a = answers(); assert.ok(validateDraft(draft, a));
 const generated = { key: personalizationKey(a), draft, token: "signed", checked: true };
 const lesson = personalizedLesson(generated, a);
 assert.equal(lesson.chat.expectedChoiceId, lesson.transferBuild.result.id);
 assert.equal(lesson.build.chunks.map(c => c.label).join(""), "我要茶");
 assert.deepEqual(parseFirstLesson({ lessonId: lesson.id, generated }).generated, generated);
});
test("rejects known targets, excessive unknown support, malformed chunks, and excluded alternatives", () => {
 const a = answers(); const known = answers(); known.vocabBasic.selectedIds.push("cha");
 assert.equal(validateDraft(draft, known), null);
 assert.equal(validateDraft(draft, a, ["咖啡"]), null);
 assert.equal(parseDraft({ ...draft, second: { ...draft.second, hanzi: "我要水。" } }), null);
 assert.equal(parseDraft({ ...draft, targets: [{ ...draft.targets[0], hanzi: "<script>" }, draft.targets[1]] }), null);
 const extra = [w("麻烦", "máfan", "please"), w("告诉", "gàosu", "tell"), w("一下", "yíxià", "briefly"), ...draft.questionWords];
 assert.equal(validateDraft({ ...draft, questionWords: extra, question: w(extra.map(w => w.hanzi).join(""), "máfan gàosu yíxià nǐ yào shénme", "Please tell me what you want.") }, a), null);
});
test("DeepSeek uses JSON content, and missing keys, invalid output, and provider errors fall back", async () => {
 const a = answers();
 assert.equal((await generateLesson(a, [], { apiKey: null })).reason, "no_key");
 let payload: any;
 const fetcher = (async (_url: any, options: any) => { payload = JSON.parse(options.body); return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(draft) } }] })); }) as typeof fetch;
 assert.ok((await generateLesson(a, [], { apiKey: "test", fetcher })).draft);
 assert.equal(payload.response_format.type, "json_object");
 assert.equal((await generateLesson(a, [], { apiKey: "test", fetcher: (async () => new Response("{}", { status: 503 })) as typeof fetch })).draft, null);
 assert.equal((await generateLesson(a, [], { apiKey: "test", fetcher: (async () => new Response(JSON.stringify({ choices: [{ message: { content: "bad json" } }] }))) as typeof fetch })).draft, null);
 a.level.selfReport = "new";
 assert.equal((await generateLesson(a, [], { apiKey: "test", fetcher })).reason, "beginner");
});
test("pronunciation tokens authorize only generated targets and expire", () => {
 const token = lessonToken(draft, "secret", 1000);
 assert.ok(validLessonTarget(token, "我要咖啡", "secret", 2000));
 assert.equal(validLessonTarget(token, "任意文本", "secret", 2000), false);
 assert.equal(validLessonTarget(token + "x", "我要咖啡", "secret", 2000), false);
 assert.equal(validLessonTarget(token, "我要咖啡", "secret", 86401001), false);
});
