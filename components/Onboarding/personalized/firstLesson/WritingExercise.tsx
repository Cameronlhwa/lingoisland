"use client";
import {pinyin} from "pinyin-pro";
import {useEffect,useRef,useState} from "react";
import type {WritingPractice} from "@/lib/onboarding/personalized/firstLesson/curriculum";
import type {WritingGrade} from "@/lib/onboarding/personalized/firstLesson/writingGrader";
import {ConversationPrompt} from "./ConversationPrompt";
import {CARD_BORDER,GREEN,MUTED,PrimaryButton,SKY_PALE} from "../ui";
import {Feedback} from "./LessonActivities";
export type WritingContext={tier:number;goal:string;variant:number;interestKeys:string[];lessonId:string};
export function WritingExercise({practice,value,context,stepId,onChange,onComplete,onMistake,onUnavailable}:{practice:WritingPractice;value:string;context:WritingContext;stepId:string;onChange:(text:string)=>void;onComplete:()=>void;onMistake:(id:string)=>void;onUnavailable:()=>void}){
 const [result,setResult]=useState<WritingGrade|null>(null),[busy,setBusy]=useState(false),[showHint,setShowHint]=useState(false);
 const requestRef=useRef<AbortController|null>(null);
 useEffect(()=>()=>{requestRef.current?.abort();requestRef.current=null;},[]);
 const check=async()=>{
  if(result?.status==="correct"){onComplete();return;}
  if(requestRef.current||!value.trim())return;
  const controller=new AbortController();requestRef.current=controller;setBusy(true);setResult(null);
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
   const response=await fetch("/api/onboarding/writing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...context,stepId,answer:value}),signal:controller.signal});
   const grade=await response.json();
   if(requestRef.current!==controller)return;
   if(!response.ok||!["correct","retry"].includes(grade.status)||typeof grade.feedback!=="string")throw Error("Unavailable");
   setResult(grade);
   if(grade.status==="correct")setShowHint(false);
   if(grade.status==="retry"){setShowHint(true);onMistake("writing");}
  }catch{if(requestRef.current===controller)setResult({status:"unavailable",feedback:"We couldn’t check your answer just now. Please try again."});}
  finally{clearTimeout(timer);if(requestRef.current===controller){requestRef.current=null;setBusy(false);}}
 };
 return <div data-testid="writing-exercise">
  <ConversationPrompt prompt={practice.prompt} writing onUnavailable={onUnavailable}/>
  <label htmlFor="lesson-written-answer" className="mb-2 block text-sm font-semibold">Your answer</label>
  {practice.required.length>0&&<div className="mb-3 flex flex-wrap gap-2" aria-label="Words to use">{practice.required.map(word=><span key={word} lang="zh-CN" className="rounded-full px-3 py-1 text-sm font-semibold" style={{background:SKY_PALE,color:GREEN}}><span className="block">{word}</span><span className="block text-xs font-normal" style={{color:MUTED}}>{pinyin(word)}</span></span>)}</div>}
  <textarea id="lesson-written-answer" data-testid="writing-answer" lang="zh-CN" value={value} maxLength={600} rows={practice.minSentences?5:1} aria-describedby={showHint?"writing-hint":undefined} aria-busy={busy} className="w-full resize-y rounded-2xl border-2 bg-white p-4 text-lg leading-relaxed outline-offset-2" style={{borderColor:CARD_BORDER,outlineColor:GREEN}} onChange={e=>{requestRef.current?.abort();requestRef.current=null;setBusy(false);setResult(null);onChange(e.target.value);}} placeholder="在这里写中文…"/>
  <p className="mt-1 text-right text-xs" style={{color:MUTED}}>{value.length} / 600</p>
  {result&&<Feedback correct={result.status==="correct"}>{result.feedback}</Feedback>}
  {showHint&&<p id="writing-hint" data-testid="writing-hint" className="mt-3 rounded-xl p-3 text-sm leading-relaxed" style={{background:SKY_PALE,color:MUTED}}>Hint: {practice.hint}</p>}
  <PrimaryButton className="mt-5" data-testid="writing-check" disabled={busy||!value.trim()} onClick={()=>void check()}>{busy?"Checking your answer…":result?.status==="correct"?"Continue":result?.status==="unavailable"?"Try again":"Check my answer"}</PrimaryButton>
 </div>;
}
