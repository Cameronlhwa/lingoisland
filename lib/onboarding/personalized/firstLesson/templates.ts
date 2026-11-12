import content from "./template-content.json";
import { getInterest } from "../goals";
import type { OnboardingAnswers } from "../flow";
import { estimateLevelFromVocab, getVocabWord, lessonBandFor } from "../vocabRecognition";
import type { AuthoredLesson, BuildPrompt, LessonPhrase, MatchPair } from "./types";

export type TemplateWord = { hanzi: string; pinyin: string; meaning: string; hsk: number };
export type TemplateRow = typeof content[number];
export type TemplatePlan = { version: 1; key: string; templateId: string; familiarWords: string[]; checked: boolean; patternFamiliar: boolean };
export const CHAT_TEMPLATES = content;
const clean = (s: string) => s.replace(/[，。！？、\s]/g, "");
export function templateWords(row: TemplateRow): TemplateWord[] {
  return Array.from(new Map([...row.prefix, ...row.aWords, ...row.bWords, ...row.suffix, ...row.huahua.words].map(w => [w.hanzi, w])).values());
}
export function templateKey(a: OnboardingAnswers): string {
  const screen = (s: OnboardingAnswers["vocabBasic"]) => {
    const shown=Array.from(new Set(s.shownIds.filter(id=>Boolean(getVocabWord(id))))).sort();
    return [shown, s.noneKnown || s.skipped ? [] : Array.from(new Set(s.selectedIds.filter(id=>shown.includes(id)))).sort(), Boolean(s.noneKnown), Boolean(s.skipped)];
  };
  const value = JSON.stringify([a.goal.primary,a.interests.keys.filter(k=>Boolean(getInterest(k))),a.level.selfReport,screen(a.vocabBasic),screen(a.vocabAdvanced)]);
  let hash = 2166136261; for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return `templates-v1-${(hash >>> 0).toString(36)}`;
}
export function templateTier(a: OnboardingAnswers): number {
  return Math.min(6, estimateLevelFromVocab({ selfReport: a.level.selfReport, basic: a.vocabBasic, advanced: a.vocabAdvanced }) + 1);
}
export function vocabularyEvidence(a: OnboardingAnswers) {
  const known = new Set<string>(), unknown = new Set<string>();
  for (const screen of [a.vocabBasic, a.vocabAdvanced]) if (!screen.skipped) for (const id of screen.shownIds) {
    const word = getVocabWord(id); if (!word) continue;
    (screen.selectedIds.includes(id) && !screen.noneKnown ? known : unknown).add(word.hanzi);
  }
  return { known, unknown };
}
export function teachingWords(plan: TemplatePlan): TemplateWord[] {
  const row = CHAT_TEMPLATES.find(t => t.id === plan.templateId)!;
  const unfamiliar = templateWords(row).filter(w => !plan.familiarWords.includes(w.hanzi));
  // Teach the core words first; incoming-only cues come last, before preparation.
  return unfamiliar.sort((a, b) => Number(row.focus.includes(b.hanzi)) - Number(row.focus.includes(a.hanzi)));
}
export function makeTemplatePlan(a: OnboardingAnswers, row: TemplateRow, predicted?: string[]): TemplatePlan {
  const evidence = vocabularyEvidence(a), level = templateTier(a) - 1;
  const familiarWords = templateWords(row).filter(w => !evidence.unknown.has(w.hanzi) && (evidence.known.has(w.hanzi) || (level > 0 && (predicted ? predicted.includes(w.hanzi) : w.hsk <= level && !row.focus.includes(w.hanzi))))).map(w => w.hanzi);
  return { version: 1, key: templateKey(a), templateId: row.id, familiarWords, checked: level === 0, patternFamiliar: false };
}
export function fallbackTemplatePlan(a: OnboardingAnswers, exclude: string[] = [], reportedUnknown: string[] = []): TemplatePlan {
  const goal = a.goal.primary ?? "other", tier = templateTier(a);
  const candidates = CHAT_TEMPLATES.filter(t => t.goal === goal && t.tier <= tier && !exclude.includes(t.id)).sort((a,b) => b.tier-a.tier);
  for (const row of candidates) {
    const initial = makeTemplatePlan(a, row);
    const plan = {...initial,familiarWords:initial.familiarWords.filter(w=>!reportedUnknown.includes(w))};
    if (teachingWords(plan).length <= (row.tier === 1 ? 5 : 3)) return plan;
  }
  const initial=makeTemplatePlan(a,CHAT_TEMPLATES.find(t=>t.goal===goal&&t.tier===1)!);
  return {...initial,familiarWords:initial.familiarWords.filter(w=>!reportedUnknown.includes(w))};
}
export function parseTemplatePlan(raw: unknown): TemplatePlan | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as TemplatePlan, row = CHAT_TEMPLATES.find(t => t.id === p.templateId);
  if (!row || p.version !== 1 || typeof p.key !== "string" || !/^templates-v1-[a-z0-9]+$/.test(p.key) || !Array.isArray(p.familiarWords)) return null;
  const allowed = new Set(templateWords(row).map(w => w.hanzi));
  return { version: 1, key: p.key, templateId: row.id, familiarWords: Array.from(new Set(p.familiarWords.filter((w): w is string => typeof w === "string" && allowed.has(w)))), checked: p.checked === true, patternFamiliar: p.patternFamiliar === true };
}
export function validTemplatePlan(raw: unknown, a: OnboardingAnswers): TemplatePlan | null {
  const p = parseTemplatePlan(raw); if (!p || p.key !== templateKey(a)) return null;
  const row = CHAT_TEMPLATES.find(t => t.id === p.templateId)!;
  if (row.goal !== (a.goal.primary ?? "other") || row.tier > templateTier(a)) return null;
  const unknown = vocabularyEvidence(a).unknown;
  if (p.familiarWords.some(w => unknown.has(w))) return null;
  return teachingWords(p).length <= (row.tier === 1 ? 5 : 3) ? p : null;
}
export function templatePrerequisites(plan: TemplatePlan, a: OnboardingAnswers): TemplateWord[] {
  const row = CHAT_TEMPLATES.find(t => t.id === plan.templateId)!, known = vocabularyEvidence(a).known;
  return templateWords(row).filter(w => plan.familiarWords.includes(w.hanzi) && !known.has(w.hanzi)).sort((a,b) => b.hsk-a.hsk).slice(0,3);
}
const p = (id: string, w: { hanzi: string; pinyin: string; meaning: string }): LessonPhrase => ({ id, ...w });
const joined = (id: string, ws: TemplateWord[]): LessonPhrase => ({ id, hanzi: ws.map(w => w.hanzi).join(""), pinyin: ws.map(w => w.pinyin).join(" "), meaning: ws.map(w => w.meaning).join(" · ") });
const bandForTier = (tier: number) => lessonBandFor(Math.min(6,tier-1) as 0|1|2|3|4|5|6);
export function compileTemplate(plan: TemplatePlan): AuthoredLesson {
  const row = CHAT_TEMPLATES.find(t => t.id === plan.templateId)!;
  const all = templateWords(row), teach = teachingWords(plan);
  const expression = {...row.practice};
  const cards = teach.length ? teach : plan.patternFamiliar ? [] : [expression];
  const match = (cards.length ? cards : [expression]).map((w,i) => ({ id: `teach-${i}`, hanzi:w.hanzi, pinyin:w.pinyin, label:w.meaning, visual:"word" }));
  const a = p("reply-a", row.practice), b = p("reply-b",row.transfer);
  const choices: MatchPair[] = [row.aWords,row.bWords].map((ws,i) => { const part=joined(`slot-${i}`,ws); return {id:part.id,hanzi:part.hanzi,pinyin:part.pinyin,label:part.meaning,visual:"word"}; });
  const build = (index: number): BuildPrompt => {
    const variable = index===0 ? row.aWords : row.bWords;
    const chunks = row.tier===1 ? [...row.prefix.map((w,i) => p(`prefix-${i}`,w)), joined(`slot-${index}`,variable), ...row.suffix.map((w,i) => p(`suffix-${i}`,w))] : [...(row.prefix.length?[joined("prefix",row.prefix)]:[]),joined(`slot-${index}`,variable),...(row.suffix.length?[joined("suffix",row.suffix)]:[])];
    return {prompt:index===0?a.meaning:b.meaning,result:index===0?a:b,chunks:chunks.map(w=>({id:w.id,label:w.hanzi,pinyin:w.pinyin,meaning:w.meaning})),order:chunks.map(w=>w.id),slotId:`slot-${index}`,options:choices};
  };
  const replyWords = new Set([...row.prefix,...row.aWords,...row.bWords,...row.suffix].map(w=>w.hanzi));
  const incoming = row.huahua.words.filter(w => !replyWords.has(w.hanzi) && teach.some(t => t.hanzi===w.hanzi));
  return { id:`template-${row.id}`,route:row.goal==="travel"?"travel":row.goal==="work"||row.goal==="school"?"work":"social",band:bandForTier(row.tier),outcome:row.title,situation:row.scene,skill:row.explanation,huahuaPose:"coaching",targets:[a,b],match,build:build(0),transferBuild:build(1),starter:joined("starter",row.prefix),sentenceWords:[...row.prefix,...row.bWords,...row.suffix].map((w,i)=>p(`word-${i}`,w)),questionWords:row.huahua.words.map((w,i)=>p(`question-${i}`,w)),mission:`Say: “${b.meaning}”`,speakTargetId:a.id,completionLine:`You can ${row.title.charAt(0).toLowerCase()+row.title.slice(1)} in Mandarin.`,
    chat:{huahua:p("incoming",row.huahua),choices:[a,b],expectedChoiceId:b.id,responses:{[b.id]:p("closing",row.closing)},outcomeVisual:{[b.id]:"check"}},
    template:{id:row.id,tier:row.tier,scene:row.scene,teaching:cards.map((w,i)=>p(`teach-${i}`,w)),incomingTeaching:incoming.map((w,i)=>p(`incoming-${i}`,w)),construction:row.incomingNote,shortRoute:cards.length<=1,quizPairs:match.length>1?match:[...match,...(teach.length ? all.filter(w=>w.hanzi!==match[0].hanzi).slice(0,1) : [row.transfer]).map(w=>({id:"review-contrast",hanzi:w.hanzi,pinyin:w.pinyin,label:w.meaning,visual:"word"}))]}
  };
}
export function isTemplatePronunciationTarget(text: string): boolean {
  return CHAT_TEMPLATES.some(t => [t.practice.hanzi,t.transfer.hanzi].some(s => clean(s)===clean(text)));
}
