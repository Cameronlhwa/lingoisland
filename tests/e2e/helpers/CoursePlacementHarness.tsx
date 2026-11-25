"use client";
import {useEffect,useState} from "react";
import {FirstLessonStep} from "@/components/Onboarding/personalized/FirstLessonStep";
import {initialState,updateAnswers,parseFirstLesson,type OnboardingState} from "@/lib/onboarding/personalized/flow";
const levels = ["new","few_words","simple_sentences","basic_conversations","familiar_topics","complex_topics"] as const;
export default function Harness(){
 const [state,setState]=useState<OnboardingState|null>(null);
 useEffect(()=>{
  const tier=Number(new URLSearchParams(location.search).get("tier")??2);
  const saved=localStorage.getItem("placement-fixture");
  const initial=saved?JSON.parse(saved):initialState(new Date(),"test");
  initial.answers.level.selfReport=levels[tier-1];initial.answers.goal.primary="heritage";
  initial.answers.firstLesson=parseFirstLesson(initial.answers.firstLesson);
  setState(initial);
 },[]);
 if(!state)return null;
 return <FirstLessonStep state={state} update={patch=>setState(previous=>{
  const next=updateAnswers(previous!,patch,new Date());
  localStorage.setItem("placement-fixture",JSON.stringify(next));return next;
 })} next={()=>{}} back={null} track={()=>{}} announce={()=>{}} ensureSession={async()=>true} progress={{index:1,total:1}}/>;
}
