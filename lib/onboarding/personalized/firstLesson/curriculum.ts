import type { OnboardingAnswers } from "../flow";
import type { AuthoredLesson } from "./types";
import { makeBudgetCourse, type CourseTier } from "./budgetCourseContent";
import { hasCurrentVocabAssessment, suggestedCourseFromVocab } from "../vocabRecognition";
import { parseCoursePlacement } from "./coursePlacement";
export type { TeachingPart, TeachingExample, GrammarCard, LessonReading, WritingPractice, CurriculumPractice, VocabularyGroup, Curriculum } from "@/lib/lessons/curriculum";

export function updatedLessonLevel(a:OnboardingAnswers):CourseTier|null {
 if(hasCurrentVocabAssessment(a.vocabBasic,a.vocabAdvanced)) return suggestedCourseFromVocab(a.vocabBasic,a.vocabAdvanced,a.firstLevelVariant);
 // Direct testing shortcuts and legacy runs have no current assessment.
 return ({new:1,few_words:2,simple_sentences:3,basic_conversations:4,familiar_topics:5,complex_topics:6} as const)[a.level.selfReport as NonNullable<typeof a.level.selfReport>] ?? null;
}
export function updatedFirstLesson(a:OnboardingAnswers):AuthoredLesson|null {
 const tier=updatedLessonLevel(a);if(!tier)return null;
 const goal=a.goal.primary??"other", placement=parseCoursePlacement(a.firstLesson?.coursePlacement);
 const active=placement&&placement.goal===goal&&placement.requestedTier===tier&&(placement.firstLevelVariant??"control")===(a.firstLevelVariant??"control")?placement:null;
 return makeBudgetCourse(active?.tier??tier,goal,active?.variant??0,a);
}
export function isUpdatedPronunciationTarget(text:string):boolean {
 const clean=(s:string)=>s.replace(/[，。！？、\s]/g,"");
 return (["heritage","work","school","travel","everyday","other"] as const).some(goal=>
 ([1,2,3,4,5,6] as CourseTier[]).some(tier=>[0,1].some(variant=>(["control","test"] as const).some(firstLevel=>{
  const lesson=makeBudgetCourse(tier,goal,variant,{goal:{primary:goal},interests:{keys:[]},firstLevelVariant:firstLevel} as unknown as OnboardingAnswers);
  return [...lesson.targets,...lesson.chat.choices,...(lesson.curriculum?.followUp?.choices??[])].some(p=>clean(p.hanzi)===clean(text));
 }))));
}
