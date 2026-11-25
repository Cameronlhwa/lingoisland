"use client";
import styles from "./CoursePlacementGate.module.css";
import { useState, useEffect, type ReactNode } from "react";
import type { OnboardingAnswers } from "@/lib/onboarding/personalized/flow";
import type { FirstLessonProgress } from "@/lib/onboarding/personalized/firstLesson/types";
import { EMPTY_FIRST_LESSON } from "@/lib/onboarding/personalized/firstLesson/types";
import { vocabularyEvidence } from "@/lib/onboarding/personalized/firstLesson/templates";
import { makeBudgetCourse, type BudgetCourse, type CourseTier } from "@/lib/onboarding/personalized/firstLesson/budgetCourseContent";
import { beginPlacement, parseCoursePlacement, recordWordCheck, finishGrammarProbe, placementWordsToShow, placeCourse, placementFoundationIds, type CoursePlacement } from "@/lib/onboarding/personalized/firstLesson/coursePlacement";
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
 const course=makeBudgetCourse(placement.tier,goal,placement.variant,answers);
 const persist=(next:CoursePlacement)=>{
  setPlacement(next);
  if(next.status==="ready"){
   const chosen=makeBudgetCourse(next.tier,goal,next.variant,answers);
   onSave({...EMPTY_FIRST_LESSON,lessonId:chosen.id,coursePlacement:next,vocabularyKnownIds:chosen.match.filter(w=>next.evidence[w.id]===true).map(w=>w.id),vocabularyChecked:true});
  } else onSave({...answers.firstLesson,coursePlacement:next});
 };
 const visible=placementWordsToShow(placement);
 const needsLessonReset=placement.status==="ready"&&(answers.firstLesson.lessonId!==course.id||answers.firstLesson.version!==2);
 useEffect(()=>{
  // If a replacement course has no unseen vocabulary, use the saved answers directly.
  if(placement.status==="checking"&&!visible.length)persist(placeCourse(placement));
  if(needsLessonReset)persist(placement);
 },[placement,needsLessonReset]);
 // Mount the player only after its selected course and known words are saved together.
 // Otherwise its one-time state initializer can capture the previous lesson's progress.
 if(needsLessonReset)return <StepFrame title="Your lesson is almost ready." onBack={onBack}><p role="status" className="py-6 text-sm" style={{color:MUTED}}>Getting your lesson ready…</p></StepFrame>;
 if(placement.status==="ready")return children(course);
 if(placement.status==="probe")return <GrammarProbe key={`${course.id}-probe`} course={course} onBack={onBack} onFinish={passed=>persist(finishGrammarProbe(placement,passed))}/>;
 const selected=course.match.filter(w=>placement.evidence[w.id]===true).map(w=>w.id);
 const changeKnown=(known:string[])=>{
  const ids=new Set(known),evidence={...placement.evidence};visible.forEach(w=>{evidence[w.id]=ids.has(w.id);});
  // Persist the draft without choosing a course until Continue is pressed.
  persist({...placement,evidence});
 };
 const supporting=new Set(placementFoundationIds(course));
 return <StepFrame title="Let’s find your starting point." subtitle="Tap words you understand. Leave the others unselected." onBack={onBack}>
  <div data-testid="course-placement" data-course-tier={placement.tier} data-course-variant={placement.variant}>
   {placement.notice&&<p role="status" className="mb-4 rounded-2xl p-3 text-sm" style={{background:SKY_PALE,color:GREEN}}>{placement.notice}</p>}
   {placement.visited.length>0&&<p className="mb-3 text-sm" style={{color:MUTED}}>Just a few different words to check. We’ve kept your earlier answers.</p>}
   <p className="mb-4 font-semibold" style={{color:NAVY}}>{course.outcome}</p>
   {[{title:"A few words from this lesson",words:visible.filter(w=>!supporting.has(w.id))},{title:"A few words we’ll build on",words:visible.filter(w=>supporting.has(w.id))}].filter(g=>g.words.length).map(group=><div key={group.title} className="mb-4">
    <p className="mb-2 text-sm font-semibold" style={{color:MUTED}}>{group.title}</p>
    <div className="grid grid-cols-3 gap-2">{group.words.map(w=><button key={w.id} type="button" aria-pressed={selected.includes(w.id)} data-testid={`known-word-${w.id}`} onClick={()=>changeKnown(selected.includes(w.id)?selected.filter(id=>id!==w.id):[...selected,w.id])} className="min-h-[64px] rounded-2xl border-2 px-2 py-2 sm:min-h-20 sm:px-3 sm:py-3 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{borderColor:selected.includes(w.id)?GREEN:CARD_BORDER,background:selected.includes(w.id)?SKY_PALE:"white",outlineColor:GREEN}}><span lang="zh-CN" className="block text-xl font-bold">{w.hanzi}</span><span className="mt-1 block text-sm" style={{color:MUTED}}>{w.pinyin}</span></button>)}</div>
   </div>)}
   <div className="flex flex-wrap justify-center gap-3"><TextButton data-testid="vocabulary-know-all" onClick={()=>changeKnown(visible.map(w=>w.id))}>I know all of these</TextButton><TextButton data-testid="vocabulary-know-none" onClick={()=>changeKnown([])}>These are all new</TextButton></div>
   <PrimaryButton mobileSticky data-testid="course-placement-continue" className="mt-4" onClick={()=>persist(recordWordCheck(placement,selected))}>Find my lesson</PrimaryButton>
   <p className="mt-3 text-center text-xs" style={{color:MUTED}}>New lesson words are expected. We mainly use the foundations to find your starting point.</p>
  </div>
 </StepFrame>;
}
function GrammarProbe({course,onBack,onFinish}:{course:BudgetCourse;onBack:(()=>void)|null;onFinish:(passed:boolean)=>void}){
 const [index,setIndex]=useState(0),[selected,setSelected]=useState<string|null>(null),[correct,setCorrect]=useState(0);
 const question=course.budget.probes[index];
 const advance=(answer:string|null)=>{
  const score=correct+Number(answer===question.correct);
  if(index+1===course.budget.probes.length)onFinish(score===course.budget.probes.length);
  else{setCorrect(score);setIndex(i=>i+1);setSelected(null);}
 };
 return <StepFrame title="Let’s find the right lesson." subtitle="Two quick questions to find your next step." onBack={onBack}>
  <div className={styles.probe} data-testid="course-grammar-probe" data-course-tier={course.budget.tier}>
   <div className={styles.progress} aria-live="polite">
    <span>Question {index+1} of {course.budget.probes.length}</span>
    <span className={styles.steps} aria-hidden>{course.budget.probes.map((_,i)=><span key={i} className={i<=index?styles.current:undefined}/>)}</span>
   </div>
   <h2 className={styles.task}>Which sentence means this?</h2>
   <p className={styles.meaning} data-testid="course-probe-meaning">“{question.prompt}”</p>
   <div className={styles.choices} role="group" aria-label="Choose the Mandarin sentence">
    {question.choices.map(w=><button key={w.id} type="button" aria-pressed={selected===w.id} data-testid={`probe-option-${w.id}`} onClick={()=>setSelected(w.id)} className={styles.choice}>
     <span className={styles.radio} aria-hidden/>
     <span className={styles.word}><span lang="zh-CN" className={styles.hanzi}>{w.hanzi}</span><span className={styles.pinyin}>{w.pinyin}</span></span>
    </button>)}
   </div>
   <PrimaryButton mobileSticky data-testid="course-probe-continue" disabled={!selected} className="mt-5" onClick={()=>advance(selected)}>Continue <span aria-hidden>→</span></PrimaryButton>
   <TextButton data-testid="course-probe-unsure" className="mt-1" onClick={()=>advance(null)}>I’m not sure</TextButton>
  </div>
 </StepFrame>;
}
