"use client";
import {useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import {initialState,updateAnswers, type OnboardingAnswers} from "@/lib/onboarding/personalized/flow";
import {GoalStep,InterestsStep,LevelStep,AvailabilityStep} from "@/components/Onboarding/personalized/ProfileSteps";
import {ExperienceStep,UsingPainStep,LearningPainStep,ReviewsStep} from "@/components/Onboarding/personalized/PainSteps";
import {VocabRecognitionStep} from "@/components/Onboarding/personalized/VocabRecognitionStep";
import {PronunciationStep} from "@/components/Onboarding/personalized/PronunciationStep";
import * as Control from "@/components/Onboarding/personalized/ControlPlanSteps";
import * as Mini from "@/components/Onboarding/personalized/PlanSteps";
import {FirstLessonStep} from "@/components/Onboarding/personalized/FirstLessonStep";
import {OnboardingPreview} from "@/components/Onboarding/personalized/OnboardingExperiment";
import {PreviewPaywall} from "@/components/Onboarding/personalized/PreviewPaywall";
import {Shell} from "@/components/Onboarding/personalized/ui";
import {EMPTY_FIRST_LESSON} from "@/lib/onboarding/personalized/firstLesson/types";
import {selectFirstLesson} from "@/lib/onboarding/personalized/firstLesson/select";
import type {StepProps} from "@/components/Onboarding/personalized/stepTypes";
export default function Harness(){
 const q=useSearchParams();const screen=q.get("screen")??"goal";
 const [state,setState]=useState(()=>{
  let s=initialState(new Date(),"test");
  s=updateAnswers(s,{goal:{primary:"work",secondary:"school",otherText:null},interests:{keys:["meetings","clients"],custom:null},level:{selfReport:q.get("beginner")==="1"?"new":"basic_conversations"},experience:{key:"on_and_off"},usingPain:{keys:["stay_quiet"],timing:"ongoing",upcomingText:null},availability:{minutes:"60",days:"5",session:"auto"}},new Date());
  const lesson=selectFirstLesson({goal:s.answers.goal.primary,interestKeys:s.answers.interests.keys,selfReport:s.answers.level.selfReport,basic:s.answers.vocabBasic,advanced:s.answers.vocabAdvanced});
  s.answers.firstLesson={...EMPTY_FIRST_LESSON,lessonId:lesson.id,phase:(q.get("phase")??"intro") as typeof EMPTY_FIRST_LESSON.phase};
  return s;
 });
 const [done,setDone]=useState(false);
 const [ready,setReady]=useState(false);useEffect(()=>setReady(true),[]);
 const update=(patch:Partial<OnboardingAnswers>)=>setState(current=>updateAnswers(current,patch,new Date()));
 const props:StepProps={state,update,next:()=>setDone(true),back:()=>{},progress:{index:3,total:12},track:()=>{},announce:()=>{}};
 const Components:Record<string,React.ReactNode>={goal:<GoalStep {...props}/>,interests:<InterestsStep {...props}/>,level:<LevelStep {...props}/>,vocab_basic:<VocabRecognitionStep {...props} band="basic"/>,vocab_advanced:<VocabRecognitionStep {...props} band="advanced"/>,experience:<ExperienceStep {...props}/>,using_pain:<UsingPainStep {...props}/>,learning_pain:<LearningPainStep {...props}/>,reviews:<ReviewsStep {...props}/>,pronunciation:<PronunciationStep {...props} ensureSession={async()=>false}/>,availability:<AvailabilityStep {...props}/>,reflect:<Control.ReflectStep {...props}/>,reflect_test:<Mini.ReflectStep {...props}/>,commitment:<Control.CommitmentStep {...props} defaultName="Cameron"/>,commitment_test:<Mini.CommitmentStep {...props} defaultName="Cameron"/>,first_lesson:<FirstLessonStep {...props} ensureSession={async()=>false}/>};
 if(screen==="paywall")return <OnboardingPreview><div data-mobile-ready={ready}><PreviewPaywall state={state}/></div></OnboardingPreview>;
 return <OnboardingPreview><Shell wide={screen.startsWith("reflect")?"xl":screen.startsWith("commitment")||screen==="reviews"}><div data-mobile-ready={ready} data-testid="mobile-review-screen" data-step={screen}>{done?<p data-testid="advanced">Continued</p>:Components[screen]}</div></Shell></OnboardingPreview>;
}
