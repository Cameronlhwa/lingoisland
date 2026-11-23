import type { OnboardingAnswers } from "../flow";
import type { AuthoredLesson, BuildPrompt, LessonPhrase } from "./types";
import { makeBudgetCourse, type CourseTier } from "./budgetCourseContent";
import { parseCoursePlacement } from "./coursePlacement";
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
export type Curriculum = { vocabularyGroups:VocabularyGroup[]; cards: GrammarCard[]; practices: CurriculumPractice[]; note: {title: string; text: string}; pronunciation?: boolean; checksAfterTeaching?: boolean; vocabularyMatching?: boolean; discussion?: import("./types").ChatTurn };

export function updatedLessonLevel(a:OnboardingAnswers):CourseTier|null {
 return ({new:1,few_words:2,simple_sentences:3,basic_conversations:4,familiar_topics:5,complex_topics:6} as const)[a.level.selfReport as NonNullable<typeof a.level.selfReport>] ?? null;
}
export function updatedFirstLesson(a:OnboardingAnswers):AuthoredLesson|null {
 const tier=updatedLessonLevel(a);if(!tier)return null;
 const goal=a.goal.primary??"other", placement=parseCoursePlacement(a.firstLesson?.coursePlacement);
 const active=placement&&placement.goal===goal&&placement.requestedTier===tier?placement:null;
 return makeBudgetCourse(active?.tier??tier,goal,active?.variant??0,a);
}
export function isUpdatedPronunciationTarget(text:string):boolean {
 const clean=(s:string)=>s.replace(/[，。！？、\s]/g,"");
 return (["heritage","work","school","travel","everyday","other"] as const).some(goal=>
 ([1,2,3,4,5,6] as CourseTier[]).some(tier=>[0,1].some(variant=>{
  const lesson=makeBudgetCourse(tier,goal,variant);
  return [...lesson.targets,...lesson.chat.choices].some(p=>clean(p.hanzi)===clean(text));
 })));
}
