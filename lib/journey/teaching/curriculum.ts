import { pinyin } from "pinyin-pro";
import type { Curriculum, GrammarCard, WritingPractice } from "@/lib/onboarding/personalized/firstLesson/curriculum";
import type { BuildPrompt, MatchPair } from "@/lib/onboarding/personalized/firstLesson/types";
import type { GrammarPoint } from "@/lib/deepseek/generate-grammar-focus";
import { grammarSteps } from "@/lib/onboarding/personalized/firstLesson/grammarSequence";

export const LESSON_VERSION = "journey-mini-v1";
// Each journey revisits a level through five distinct communicative objectives.
// These are product teaching bands, not claims about official HSK equivalence.
const OBJECTIVES = {
  A0: [["叫", "Introduce yourself by name"], ["有", "Say what you have"], ["想要", "Ask for something you want"], ["不", "Say what you do not want or do"], ["吗", "Ask a simple yes-or-no question"]],
  A1: [["会", "Talk about a learned skill"], ["想", "Say what you want to do"], ["在", "Say where something is"], ["多少", "Ask about a quantity or price"], ["可以", "Ask for permission or explain what is allowed"]],
  A2: [["能", "Explain what circumstances allow"], ["了", "Talk about a completed action"], ["先…再…", "Explain a sequence"], ["因为…所以…", "Give a reason and a result"], ["比", "Compare two things"]],
  B1: [["还是 / 或者", "Ask for a choice and describe alternatives"], ["虽然…但是…", "Explain a contrast"], ["如果…就…", "Explain a condition and a result"], ["把", "Describe what happens to an object"], ["越…越…", "Describe how two things change together"]],
  B2: [["除了…以外…还…", "Add another point"], ["不仅…而且…", "Develop a point with additional information"], ["即使…也…", "Describe a result despite a condition"], ["不是…而是…", "Correct an interpretation"], ["尽管…还是…", "Explain a decision despite a difficulty"]],
  C1: [["一方面…另一方面…", "Weigh two sides of a topic"], ["与其…不如…", "Recommend one alternative over another"], ["宁可…也不…", "Express a strong preference"], ["就…而言", "Frame the scope of an argument"], ["无论…都…", "Explain what holds across different conditions"]],
} as const;
export type TeachingLevel = keyof typeof OBJECTIVES;
export type TeachingObjective = { id: string; level: TeachingLevel; pattern: string; outcome: string };
export function selectObjective(level: string, order: number): TeachingObjective {
  const base = Object.keys(OBJECTIVES).find(key => level.toUpperCase().startsWith(key)) as TeachingLevel | undefined;
  if (!base || !Number.isInteger(order) || order < 1 || order > 5) throw new Error("Invalid journey lesson level or order");
  const [pattern, outcome] = OBJECTIVES[base][order - 1];
  return { id: `${LESSON_VERSION}:${base}:${order}`, level: base, pattern, outcome };
}
export type LessonWord = { id: string; hanzi: string; pinyin: string; english: string; position?: number };
export type JourneyLesson = {
  version: typeof LESSON_VERSION; id: string; topic: string; objective: TeachingObjective;
  words: MatchPair[]; curriculum: Curriculum;
  speaking: { hanzi: string; pinyin: string; meaning: string };
  mission: string;
};

function build(example: GrammarPoint["examples"][number], id: string): BuildPrompt {
  const segments = Array.from(new Intl.Segmenter("zh", { granularity: "word" }).segment(example.hanzi))
    .filter(piece => /[\u3400-\u9fffA-Za-z0-9]/.test(piece.segment)).map(piece => piece.segment);
  if (segments.length < 2 || segments.length > 40) throw new Error("Grammar example cannot form a sentence exercise");
  const chunks = segments.map((label, index) => ({ id: `${id}:${index}`, label, pinyin: pinyin(label) }));
  return { prompt: example.english, chunks, order: chunks.map(chunk => chunk.id), result: { id, hanzi: example.hanzi, pinyin: example.pinyin, meaning: example.english } };
}

export function compileJourneyLesson(islandId: string, topic: string, objective: TeachingObjective, point: GrammarPoint, words: LessonWord[]): JourneyLesson {
  if (point.examples.length !== 2 || !words.length) throw new Error("Teaching content is incomplete");
  const examples = [...point.examples].sort((a, b) => a.tier === b.tier ? 0 : a.tier === "warmup" ? -1 : 1);
  const first = build(examples[0], "warmup"), second = build(examples[1], "target");
  const card: GrammarCard = {
    id: objective.id, format: objective.pattern.includes("/") ? "contrast" : "pattern", title: objective.outcome,
    explanation: point.whenToUse || point.english, detail: `${point.whenToUse || ""} ${point.pattern}`.trim(), takeaway: `${point.hanzi} — ${point.english}`,
    examples: examples.map((ex, index) => ({ id: `example:${index}`, hanzi: ex.hanzi, pinyin: ex.pinyin, meaning: ex.english, keyWords: objective.pattern.split(/[\s…./]+/).filter(Boolean), label: index ? "Use it in your topic" : "Start here" })),
    check: { kind: "build", build: first },
  };
  const writing: WritingPractice = {
    kind: "writing", prompt: `Write your own sentence about ${topic} using ${point.hanzi}.`,
    hint: point.whenToUse || point.pattern, sample: second.result, required: [],
    rubric: `Accept any natural Mandarin sentence relevant to the topic that correctly uses ${point.hanzi} (${point.english}). The example is not an exact answer key.`,
  };
  const vocabulary = words.slice().sort((a, b) => (a.position ?? 999) - (b.position ?? 999)).filter(word => word.hanzi !== point.hanzi)
    .map(word => ({ id: word.id, hanzi: word.hanzi, pinyin: word.pinyin, label: word.english, visual: "" }));
  return {
    id: `${islandId}:${LESSON_VERSION}`, version: LESSON_VERSION, topic, objective,
    words: [{ id: "grammar-core", hanzi: point.hanzi, pinyin: point.pinyin, label: point.english, visual: "" }, ...vocabulary],
    curriculum: { cards: [card], practices: [{ kind: "build", build: second }, ...(["B1", "B2", "C1"].includes(objective.level) ? [writing] : [])], vocabularyGroups: [{ id: "core", title: "The pattern you’ll use", wordIds: ["grammar-core"] }, { id: "personalized", title: "Words for your topic", wordIds: vocabulary.map(word => word.id) }], checksAfterTeaching: true, pronunciation: true, note: { title: "Use it outside the lesson", text: objective.outcome } },
    speaking: second.result,
    mission: `Talk with Huahua about ${topic}. ${objective.outcome}. Try using ${point.hanzi} and your new words.`,
  };
}
export function lessonStepIds(lesson: JourneyLesson): string[] {
  return ["vocabulary", ...grammarSteps(lesson.curriculum).map(step => step.id), "speaking", "chat", "complete"];
}

export type LessonProgress = {
  stepId: string;
  vocabularyKnownIds?: string[]; vocabularyChecked?: boolean; vocabularyIndex?: number; vocabularyTesting?: boolean;
  writingResponses?: Record<string, string>; speakingPath?: "spoken" | "listening";
  chatMessages?: Array<{ role: "user" | "assistant"; content: string; suggestions?: string[] }>;
};
export function updateLessonProgress(lesson: JourneyLesson, current: LessonProgress, patch: unknown): LessonProgress {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("Invalid progress");
  const value = patch as Record<string, unknown>;
  const allowed = ["stepId", "vocabularyKnownIds", "vocabularyChecked", "vocabularyIndex", "vocabularyTesting", "writingResponses", "speakingPath", "chatMessages"];
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error("Unknown progress field");
  const steps = lessonStepIds(lesson), index = steps.indexOf(current.stepId);
  const next = value.stepId === undefined ? current.stepId : value.stepId;
  if (typeof next !== "string" || index < 0 || ![current.stepId, steps[index + 1]].includes(next)) throw new Error("Complete the current activity first");
  if (Object.keys(value).some(key => key.startsWith("vocabulary")) && current.stepId !== "vocabulary") throw new Error("Vocabulary review has already finished");
  if (value.chatMessages !== undefined && current.stepId !== "chat") throw new Error("Finish the teaching activities before conversation");
  if (value.speakingPath !== undefined && current.stepId !== "speaking") throw new Error("Choose a practice path during speaking");
  const result = { ...current, ...value } as LessonProgress;
  if (value.vocabularyKnownIds !== undefined && (!Array.isArray(value.vocabularyKnownIds) || value.vocabularyKnownIds.length > lesson.words.length || value.vocabularyKnownIds.some(id => typeof id !== "string" || !lesson.words.some(word => word.id === id)))) throw new Error("Invalid vocabulary selection");
  for (const key of ["vocabularyChecked", "vocabularyTesting"] as const) if (value[key] !== undefined && typeof value[key] !== "boolean") throw new Error("Invalid vocabulary progress");
  if (value.vocabularyIndex !== undefined && (!Number.isInteger(value.vocabularyIndex) || (value.vocabularyIndex as number) < 0 || (value.vocabularyIndex as number) >= lesson.words.length)) throw new Error("Invalid vocabulary position");
  if (value.writingResponses !== undefined) {
    const responses = value.writingResponses;
    if (!responses || typeof responses !== "object" || Array.isArray(responses) || Object.entries(responses).some(([id, text]) => !grammarSteps(lesson.curriculum).some(step => step.id === id && step.kind !== "teach" && step.practice.kind === "writing") || typeof text !== "string" || text.length > 600)) throw new Error("Invalid written answers");
  }
  if (value.speakingPath !== undefined && !["spoken", "listening"].includes(value.speakingPath as string)) throw new Error("Invalid speaking path");
  if (value.chatMessages !== undefined && (!Array.isArray(value.chatMessages) || value.chatMessages.length > 20 || value.chatMessages.some(message => !message || !["user", "assistant"].includes(message.role) || typeof message.content !== "string" || !message.content.trim() || message.content.length > 2000))) throw new Error("Invalid conversation");
  if (value.chatMessages !== undefined && (value.chatMessages as NonNullable<LessonProgress["chatMessages"]>).some(message => message.suggestions !== undefined && (message.role !== "assistant" || !Array.isArray(message.suggestions) || message.suggestions.length > 3 || message.suggestions.some(text => typeof text !== "string" || !text.trim() || text.length > 80)))) throw new Error("Invalid reply suggestions");
  if (current.stepId === "vocabulary" && next !== current.stepId && !result.vocabularyChecked) throw new Error("Review the vocabulary first");
  if (current.stepId === "speaking" && next !== current.stepId && !result.speakingPath) throw new Error("Choose speaking or listening practice");
  if (current.stepId === "chat" && next === "complete" && !result.chatMessages?.some(message => message.role === "user")) throw new Error("Try a reply to Huahua first");
  return result;
}
