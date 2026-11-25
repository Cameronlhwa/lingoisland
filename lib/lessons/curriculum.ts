import type { BuildPrompt, LessonPhrase } from "@/lib/onboarding/personalized/firstLesson/types";
export type TeachingPart = { hanzi: string; pinyin: string; meaning: string; variable?: boolean };
export type TeachingExample = LessonPhrase & { label: string; keyWords?: string[]; context?: string; highlight?: {hanzi:string;pinyin:string}; parts?: TeachingPart[] };
export type GrammarCard = {
 id: string; format: "change" | "pattern" | "contrast" | "exchange";
 title: string; explanation: string; examples: TeachingExample[];
 takeaway: string; detail?: string; connector?: string; check: CurriculumPractice;
};
export type LessonReading = { title: string; text: string; pinyin: string; translation: string };
export type WritingPractice = {
 kind: "writing"; prompt: string; hint: string; sample: LessonPhrase;
 required: string[]; minSentences?: number; maxSentences?: number;
 rubric: string; reading?: LessonReading;
};
export type CurriculumPractice = { kind: "build"; build: BuildPrompt }
 | { kind: "choice"; prompt: string; choices: LessonPhrase[]; correct?: string; explanation: string; reading?: LessonReading }
 | { kind: "reading"; reading: LessonReading }
 | WritingPractice;
export type VocabularyGroup = {id:"core"|"personalized";title:string;wordIds:string[]};
export type Curriculum = { vocabularyGroups:VocabularyGroup[]; cards: GrammarCard[]; practices: CurriculumPractice[]; note: {title: string; text: string}; pronunciation?: boolean; checksAfterTeaching?: boolean; vocabularyMatching?: boolean; discussion?: import("@/lib/onboarding/personalized/firstLesson/types").ChatTurn };
