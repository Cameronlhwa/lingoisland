"use client";
import { useState, type ReactNode } from "react";
import type { OnboardingAnswers } from "@/lib/onboarding/personalized/flow";
import type { FirstLessonProgress } from "@/lib/onboarding/personalized/firstLesson/types";
import { EMPTY_FIRST_LESSON } from "@/lib/onboarding/personalized/firstLesson/types";
import { vocabularyEvidence } from "@/lib/onboarding/personalized/firstLesson/templates";
import { makeBudgetCourse, type BudgetCourse, type CourseTier } from "@/lib/onboarding/personalized/firstLesson/budgetCourseContent";
import { beginPlacement, parseCoursePlacement, recordWordCheck, finishGrammarProbe, type CoursePlacement } from "@/lib/onboarding/personalized/firstLesson/coursePlacement";
import { CARD_BORDER, GREEN, MUTED, NAVY, PrimaryButton, StepFrame, TextButton, SKY_PALE } from "../ui";

export function CoursePlacementGate({answers,tier,onSave,onBack,children}:{answers:OnboardingAnswers;tier:CourseTier;onSave:(progress:FirstLessonProgress)=>void;onBack:(()=>void)|null;children:(course:BudgetCourse)=>ReactNode}) {
 const goal=answers.goal.primary??"other";
 const [placement,setPlacement]=useState<CoursePlacement>(()=>{
  const saved=parseCoursePlacement(answers.firstLesson.coursePlacement);
  if(saved&&saved.goal===goal&&saved.requestedTier===tier)return saved;
  const old=vocabularyEvidence(answers),evidence:Record<string,boolean>={};
  old.known.forEach(w=>{evidence[w]=true;});old.unknown.forEach(w=>{evidence[w]=false;});
  return beginPlacement(tier,goal,{...evidence,...saved?.evidence});
 });
 const course=makeBudgetCourse(placement.tier,goal,placement.variant);
 const persist=(next:CoursePlacement)=>{
  setPlacement(next);
  if(next.status==="ready"){
   const chosen=makeBudgetCourse(next.tier,goal,next.variant);
   onSave({...EMPTY_FIRST_LESSON,lessonId:chosen.id,coursePlacement:next,vocabularyKnownIds:chosen.match.filter(w=>next.evidence[w.id]===true).map(w=>w.id),vocabularyChecked:true});
  } else onSave({...answers.firstLesson,coursePlacement:next});
 };
 if(placement.status==="ready")return children(course);
 if(placement.status==="probe")return <GrammarProbe key={`${course.id}-probe`} course={course} onBack={onBack} onFinish={passed=>persist(finishGrammarProbe(placement,passed))}/>;
 const selected=course.match.filter(w=>placement.evidence[w.id]===true).map(w=>w.id);
 const changeKnown=(known:string[])=>{
  const ids=new Set(known),evidence={...placement.evidence};course.match.forEach(w=>{evidence[w.id]=ids.has(w.id);});
  // Persist the draft without choosing a course until Continue is pressed.
  persist({...placement,evidence});
 };
 const supporting=new Set(course.budget.prerequisiteIds);
 return <StepFrame title="Let’s find your starting point." subtitle="Select the words you already understand. Leave unfamiliar words unselected." onBack={onBack}>
  <div data-testid="course-placement" data-course-tier={placement.tier} data-course-variant={placement.variant}>
   {placement.notice&&<p role="status" className="mb-4 rounded-2xl p-3 text-sm" style={{background:SKY_PALE,color:GREEN}}>{placement.notice}</p>}
   <p className="mb-4 font-semibold" style={{color:NAVY}}>{course.outcome}</p>
   {[{title:"Words for this lesson",words:course.match.filter(w=>!supporting.has(w.id))},{title:"A few words we’ll build on",words:course.match.filter(w=>supporting.has(w.id))}].filter(g=>g.words.length).map(group=><div key={group.title} className="mb-4">
    <p className="mb-2 text-sm font-semibold" style={{color:MUTED}}>{group.title}</p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{group.words.map(w=><button key={w.id} type="button" aria-pressed={selected.includes(w.id)} data-testid={`known-word-${w.id}`} onClick={()=>changeKnown(selected.includes(w.id)?selected.filter(id=>id!==w.id):[...selected,w.id])} className="min-h-20 rounded-2xl border-2 px-3 py-3 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{borderColor:selected.includes(w.id)?GREEN:CARD_BORDER,background:selected.includes(w.id)?SKY_PALE:"white",outlineColor:GREEN}}><span lang="zh-CN" className="block text-xl font-bold">{w.hanzi}</span><span className="mt-1 block text-sm" style={{color:MUTED}}>{w.pinyin}</span></button>)}</div>
   </div>)}
   <div className="flex flex-wrap justify-center gap-3"><TextButton data-testid="vocabulary-know-all" onClick={()=>changeKnown(course.match.map(w=>w.id))}>I know all of these</TextButton><TextButton data-testid="vocabulary-know-none" onClick={()=>changeKnown([])}>These are all new</TextButton></div>
   <PrimaryButton data-testid="course-placement-continue" className="mt-4" onClick={()=>persist(recordWordCheck(placement,selected))}>Find my lesson</PrimaryButton>
   <p className="mt-3 text-center text-xs" style={{color:MUTED}}>We’ll keep new language manageable and stay with your chosen topic.</p>
  </div>
 </StepFrame>;
}
function GrammarProbe({course,onBack,onFinish}:{course:BudgetCourse;onBack:(()=>void)|null;onFinish:(passed:boolean)=>void}){
 const [index,setIndex]=useState(0),[selected,setSelected]=useState<string|null>(null),[correct,setCorrect]=useState(0);
 const question=course.budget.probes[index];
 return <StepFrame title="You know the words." subtitle="Two quick checks will help us choose the right pattern to practise." onBack={onBack}>
  <div data-testid="course-grammar-probe">
   <p className="mb-3 text-sm" style={{color:MUTED}}>Check {index+1} of {course.budget.probes.length}</p>
   <p className="mb-4 text-lg font-bold">{question.prompt}</p>
   <div className="grid gap-3 sm:grid-cols-2">{question.choices.map(w=><button key={w.id} type="button" aria-pressed={selected===w.id} data-testid={`probe-option-${w.id}`} onClick={()=>setSelected(w.id)} className="min-h-24 rounded-2xl border-2 p-4 focus-visible:outline focus-visible:outline-2" style={{borderColor:selected===w.id?GREEN:CARD_BORDER,outlineColor:GREEN}}><span lang="zh-CN" className="block text-xl font-bold">{w.hanzi}</span><span className="mt-2 block text-sm" style={{color:MUTED}}>{w.pinyin}</span></button>)}</div>
   <PrimaryButton data-testid="course-probe-continue" disabled={!selected} className="mt-5" onClick={()=>{const score=correct+Number(selected===question.correct);if(index+1===course.budget.probes.length)onFinish(score===course.budget.probes.length);else{setCorrect(score);setIndex(i=>i+1);setSelected(null);}}}>Continue</PrimaryButton>
  </div>
 </StepFrame>;
}
