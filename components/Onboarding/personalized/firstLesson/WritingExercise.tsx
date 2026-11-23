"use client";
import {pinyin} from "pinyin-pro";
import {useEffect,useRef,useState} from "react";
import type {WritingPractice} from "@/lib/onboarding/personalized/firstLesson/curriculum";
import type {WritingGrade} from "@/lib/onboarding/personalized/firstLesson/writingGrader";
import {ConversationPrompt} from "./ConversationPrompt";
import {CARD_BORDER,GREEN,MUTED,PrimaryButton,SKY_PALE} from "../ui";
import {writingCompletion} from "@/lib/onboarding/personalized/firstLesson/writing";
import styles from "./ConversationPrompt.module.css";
import {Feedback} from "./LessonActivities";
export type WritingContext={tier:number;goal:string;variant:number;interestKeys:string[];lessonId:string};
export function WritingExercise({practice,value,context,stepId,onChange,onComplete,onMistake,onUnavailable}:{practice:WritingPractice;value:string;context:WritingContext;stepId:string;onChange:(text:string)=>void;onComplete:()=>void;onMistake:(id:string)=>void;onUnavailable:()=>void}){
 const [result,setResult]=useState<WritingGrade|null>(null),[busy,setBusy]=useState(false),[showHint,setShowHint]=useState(false);
 const completion=writingCompletion(practice.prompt);
 const fragment=completion && value.startsWith(completion.prefix) ? value.slice(completion.prefix.length, completion.suffix && value.endsWith(completion.suffix) ? -completion.suffix.length : undefined) : value;
 const change=(text:string)=>{requestRef.current?.abort();requestRef.current=null;setBusy(false);setResult(null);onChange(completion && text ? `${completion.prefix}${text}${completion.suffix}` : text);};
 const requestRef=useRef<AbortController|null>(null);
 useEffect(()=>()=>{requestRef.current?.abort();requestRef.current=null;},[]);
 const check=async()=>{
  if(result?.status==="correct"){onComplete();return;}
  if(requestRef.current||!(completion?fragment:value).trim())return;
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
  {completion ? <>
   <h3 className="mb-2 text-xl font-bold">Complete the question</h3>
   <p id="writing-instructions" className="mb-4 text-sm" style={{color:MUTED}}>Type only the missing words in the highlighted field.</p>
   <ConversationPrompt prompt={completion.reply} label="Huahua’s reply" onUnavailable={onUnavailable}/>
   <label htmlFor="lesson-written-answer" className="mb-2 block text-sm font-semibold">Your question</label>
   <div className={styles.completion}>
    <span lang="zh-CN">{completion.prefix}</span>
    <input id="lesson-written-answer" data-testid="writing-answer" lang="zh-CN" value={fragment} maxLength={600-completion.prefix.length-completion.suffix.length} aria-label="Missing words" aria-describedby={`writing-instructions${showHint?" writing-hint":""}`} aria-busy={busy} onChange={e=>change(e.target.value)} placeholder="Type here…" autoComplete="off" className={styles.completionInput}/>
    <span lang="zh-CN">{completion.suffix}</span>
   </div>
  </> : <><ConversationPrompt prompt={practice.prompt} writing onUnavailable={onUnavailable}/><label htmlFor="lesson-written-answer" className="mb-2 block text-sm font-semibold">Your answer</label></>}
  {completion && <p className="mb-2 mt-4 text-xs font-semibold" style={{color:MUTED}}>Words to include</p>}
  {practice.required.length>0&&<div className="mb-3 flex flex-wrap gap-2" aria-label="Words to use">{practice.required.map(word=><span key={word} lang="zh-CN" className="rounded-full px-3 py-1 text-sm font-semibold" style={{background:SKY_PALE,color:GREEN}}><span className="block">{word}</span><span className="block text-xs font-normal" style={{color:MUTED}}>{pinyin(word)}</span></span>)}</div>}
  {!completion && <textarea id="lesson-written-answer" data-testid="writing-answer" lang="zh-CN" value={value} maxLength={600} rows={practice.minSentences?5:1} aria-describedby={showHint?"writing-hint":undefined} aria-busy={busy} className="w-full resize-y rounded-2xl border-2 bg-white p-4 text-lg leading-relaxed outline-offset-2" style={{borderColor:CARD_BORDER,outlineColor:GREEN}} onChange={e=>change(e.target.value)} placeholder="在这里写中文…"/>}
  <p className="mt-1 text-right text-xs" style={{color:MUTED}}>{completion ? fragment.length : value.length} / {completion ? 600-completion.prefix.length-completion.suffix.length : 600}</p>
  {result&&<Feedback correct={result.status==="correct"}>{result.feedback}</Feedback>}
  {showHint&&<p id="writing-hint" data-testid="writing-hint" className="mt-3 rounded-xl p-3 text-sm leading-relaxed" style={{background:SKY_PALE,color:MUTED}}>Hint: {practice.hint}</p>}
  <PrimaryButton className="mt-5" data-testid="writing-check" disabled={busy||!(completion?fragment:value).trim()} onClick={()=>void check()}>{busy?"Checking your answer…":result?.status==="correct"?"Continue":result?.status==="unavailable"?"Try again":"Check my answer"}</PrimaryButton>
 </div>;
}
