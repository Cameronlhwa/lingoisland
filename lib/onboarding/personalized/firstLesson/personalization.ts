import type { OnboardingAnswers } from "../flow";
import { getInterest } from "../goals";
import { estimateLevelFromVocab, getVocabWord, lessonBandFor } from "../vocabRecognition";
import { lessonRouteFor, selectFirstLesson } from "./select";
import type { AuthoredLesson, LessonPhrase, BuildPrompt } from "./types";

export type WordSpec = { hanzi: string; pinyin: string; meaning: string };
export type LessonDraft = {
  outcome: string; situation: string; mission: string; completion: string; explanation: string;
  targets: [WordSpec, WordSpec]; prefix: WordSpec[]; suffix: WordSpec[];
  first: WordSpec; second: WordSpec; question: WordSpec; questionWords: WordSpec[]; response: WordSpec;
};
export type PersonalizedLesson = { key: string; draft: LessonDraft; token: string; checked?: boolean };
export const cleanChinese = (text: string) => text.replace(/[，。！？、\s]/g, "");
/** Only fields explicitly needed for lesson selection; excludes all free text and personal details. */
export function lessonInput(answers: OnboardingAnswers) {
  return { goal: { primary: answers.goal.primary }, interests: { keys: answers.interests.keys.filter(key => Boolean(getInterest(key))) }, level: { selfReport: answers.level.selfReport }, vocabBasic: answers.vocabBasic, vocabAdvanced: answers.vocabAdvanced };
}
export function lessonEvidence(answers: OnboardingAnswers) {
  const screens = [answers.vocabBasic, answers.vocabAdvanced];
  const shown = Array.from(new Set(screens.filter(s => !s.skipped).flatMap(s => s.shownIds)));
  const known = new Set(screens.filter(s => !s.skipped && !s.noneKnown).flatMap(s => s.selectedIds));
  const describe = (ids: string[]) => ids.map(getVocabWord).filter((word): word is NonNullable<typeof word> => Boolean(word)).map(word => ({ hanzi: word.hanzi, pinyin: word.pinyin, hsk: word.hsk, diagnostic: Boolean(word.diagnostic) }));
  const level = estimateLevelFromVocab({ selfReport: answers.level.selfReport, basic: answers.vocabBasic, advanced: answers.vocabAdvanced });
  return { selfReport: answers.level.selfReport, estimatedLevel: level, band: lessonBandFor(level), goal: answers.goal.primary, interests: answers.interests.keys.filter(key => Boolean(getInterest(key))), known: describe(shown.filter(id => known.has(id))), unfamiliar: describe(shown.filter(id => !known.has(id))), skippedScreens: screens.map((s, i) => s.skipped ? i === 0 ? "basic" : "advanced" : null).filter(Boolean) };
}
export function personalizationKey(answers: OnboardingAnswers) {
  const text = JSON.stringify(lessonEvidence(answers)); let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `lesson-v1-${(hash >>> 0).toString(36)}`;
}
const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[<>]|https?:\/\//i.test(value);
function word(value: unknown): value is WordSpec {
  if (!value || typeof value !== "object") return false;
  const w = value as WordSpec;
  return text(w.hanzi, 60) && /^[\u3400-\u9fff，。！？、\s]+$/.test(w.hanzi) && text(w.pinyin, 220) && /[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(w.pinyin) && text(w.meaning, 180);
}
export function parseDraft(raw: unknown): LessonDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as LessonDraft;
  if (!["outcome", "situation", "mission", "completion", "explanation"].every(k => text(d[k as keyof LessonDraft], k === "explanation" ? 500 : 200))) return null;
  if (!Array.isArray(d.targets) || d.targets.length !== 2 || !d.targets.every(word) || d.targets[0].hanzi === d.targets[1].hanzi) return null;
  if (!Array.isArray(d.prefix) || d.prefix.length < 1 || d.prefix.length > 3 || !d.prefix.every(word)) return null;
  if (!Array.isArray(d.suffix) || d.suffix.length > 3 || !d.suffix.every(word)) return null;
  const segmenter = new Intl.Segmenter("zh", { granularity: "word" });
  if ([...d.prefix, ...d.suffix].some(w => Array.from(segmenter.segment(cleanChinese(w.hanzi))).filter(part => part.isWordLike).length > 1)) return null;
  if (!Array.isArray(d.questionWords) || d.questionWords.length < 1 || d.questionWords.length > 6 || !d.questionWords.every(word)) return null;
  if (![d.first, d.second, d.question, d.response].every(word)) return null;
  const joined = (ws: WordSpec[]) => ws.map(w => cleanChinese(w.hanzi)).join("");
  if (joined([...d.prefix, d.targets[0], ...d.suffix]) !== cleanChinese(d.first.hanzi) || joined([...d.prefix, d.targets[1], ...d.suffix]) !== cleanChinese(d.second.hanzi) || joined(d.questionWords) !== cleanChinese(d.question.hanzi)) return null;
  if (d.targets.some(t => cleanChinese(t.hanzi).length > 8)) return null;
  // Chunks must be distinct so tapping/removing them remains unambiguous.
  const chunks = [...d.prefix, ...d.targets, ...d.suffix].map(w => cleanChinese(w.hanzi));
  if (new Set(chunks).size !== chunks.length) return null;
  return JSON.parse(JSON.stringify({ outcome: d.outcome, situation: d.situation, mission: d.mission, completion: d.completion, explanation: d.explanation, targets: d.targets.map(w => ({ hanzi: w.hanzi, pinyin: w.pinyin, meaning: w.meaning })), prefix: d.prefix, suffix: d.suffix, first: d.first, second: d.second, question: d.question, questionWords: d.questionWords, response: d.response })) as LessonDraft;
}
export function uncertainWords(draft: LessonDraft, answers: OnboardingAnswers): WordSpec[] {
  const known = new Set(lessonEvidence(answers).known.map(w => w.hanzi));
  const targets = new Set(draft.targets.map(w => w.hanzi));
  const unique = new Map([...draft.prefix, ...draft.suffix, ...draft.questionWords].map(w => [w.hanzi, w]));
  return Array.from(unique.values()).filter(w => !known.has(w.hanzi) && !targets.has(w.hanzi));
}
export function validateDraft(raw: unknown, answers: OnboardingAnswers, excluded: string[] = []): LessonDraft | null {
  const draft = parseDraft(raw); if (!draft) return null;
  const evidence = lessonEvidence(answers);
  if (evidence.band === "beginner") return null;
  const known = new Set(evidence.known.map(w => w.hanzi));
  if (draft.targets.some(w => known.has(w.hanzi) || excluded.includes(w.hanzi))) return null;
  const explicitlyUnknown = new Set(evidence.unfamiliar.map(w => w.hanzi));
  if (explicitlyUnknown.size && !draft.targets.some(w => explicitlyUnknown.has(w.hanzi))) return null;
  if (uncertainWords(draft, answers).length > 3) return null;
  return draft;
}
export function parsePersonalizedLesson(raw: unknown): PersonalizedLesson | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as PersonalizedLesson;
  const draft = parseDraft(value.draft);
  return draft && typeof value.key === "string" && /^lesson-v1-[a-z0-9]+$/.test(value.key) && typeof value.token === "string" && value.token.length <= 5000 ? { key: value.key, draft, token: value.token, checked: value.checked === true } : null;
}
export function personalizedLesson(value: PersonalizedLesson, answers: OnboardingAnswers): AuthoredLesson {
  const d = value.draft;
  const p = (id: string, w: WordSpec): LessonPhrase => ({ id, ...w });
  const first = p("target-0", d.first), second = p("target-1", d.second);
  const starter: WordSpec = { hanzi: d.prefix.map(w => w.hanzi).join(""), pinyin: d.prefix.map(w => w.pinyin).join(" "), meaning: d.prefix.map(w => w.meaning).join(" · ") };
  const suffix: WordSpec | undefined = d.suffix.length ? { hanzi: d.suffix.map(w => w.hanzi).join(""), pinyin: d.suffix.map(w => w.pinyin).join(" "), meaning: d.suffix.map(w => w.meaning).join(" · ") } : undefined;
  const build = (index: number, result: LessonPhrase): BuildPrompt => {
    const parts = [p("starter", starter), p(`word-${index}`, d.targets[index]), ...(suffix ? [p("suffix", suffix)] : [])];
    return { prompt: result.meaning, result, chunks: parts.map(w => ({ id: w.id, label: w.hanzi, pinyin: w.pinyin, meaning: w.meaning })), order: parts.map(w => w.id) };
  };
  return { id: `generated-${value.key}`, band: lessonEvidence(answers).band, route: lessonRouteFor(answers.goal.primary, answers.interests.keys), outcome: d.outcome, situation: d.situation, skill: d.explanation, huahuaPose: "coaching", targets: [first, second], starter: p("starter", starter), suffix: suffix ? p("suffix", suffix) : undefined, match: d.targets.map((w, i) => ({ id: `word-${i}`, hanzi: w.hanzi, pinyin: w.pinyin, label: w.meaning, visual: "word" })), build: build(0, first), transferBuild: build(1, second), sentenceWords: [...d.prefix, d.targets[1], ...d.suffix].map((w, i) => p(`part-${i}`, w)), questionWords: d.questionWords.map((w, i) => p(`question-${i}`, w)), mission: d.mission, speakTargetId: first.id, completionLine: d.completion, chat: { huahua: p("question", d.question), choices: [first, second], expectedChoiceId: second.id, responses: { [second.id]: p("response", d.response) }, outcomeVisual: { [second.id]: "check" } } };
}
export function fallbackLesson(answers: OnboardingAnswers) { return selectFirstLesson({ goal: answers.goal.primary, interestKeys: answers.interests.keys, selfReport: answers.level.selfReport, basic: answers.vocabBasic, advanced: answers.vocabAdvanced }); }
