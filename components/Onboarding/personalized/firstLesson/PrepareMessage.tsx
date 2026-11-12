"use client";
import { useState } from "react";
import type { AuthoredLesson } from "@/lib/onboarding/personalized/firstLesson/types";
import { CARD_BORDER, MUTED, NAVY, PrimaryButton, SKY_PALE, TextButton } from "../ui";
import { MeaningQuiz, SentenceBreakdown, WordCard } from "./LessonActivities";

export function PrepareMessage({lesson,onContinue,onUnavailable,onMistake}:{lesson:AuthoredLesson;onContinue:()=>void;onUnavailable:()=>void;onMistake:(id:string)=>void}) {
  const incoming=lesson.template?.incomingTeaching ?? [];
  const [expanded,setExpanded]=useState(false),[checked,setChecked]=useState(incoming.length===0);
  const target=lesson.match.findIndex(p=>p.hanzi===incoming[0]?.hanzi);
  return <div data-testid="lesson-prepare-message">
    {incoming.length>0&&<div className="mb-5"><p className="mb-3 text-sm font-semibold" style={{color:MUTED}}>You’ll hear {incoming.length===1?"this word":"these words"} in Huahua’s message.</p><div className="space-y-3">{incoming.map(w=><WordCard key={w.id} phrase={w} onUnavailable={onUnavailable}/>)}</div></div>}
    <WordCard phrase={lesson.chat.huahua} onUnavailable={onUnavailable}/>
    <div className="mt-4 rounded-2xl border p-4 text-sm leading-relaxed" style={{background:SKY_PALE,borderColor:CARD_BORDER,color:NAVY}} data-testid="lesson-message-explanation">{lesson.template?.construction ?? lesson.skill}</div>
    <TextButton className="mt-2" onClick={()=>setExpanded(!expanded)}>{expanded?"Hide word breakdown":"See how the words fit together"}</TextButton>
    {expanded&&<SentenceBreakdown words={lesson.questionWords} sentence={lesson.chat.huahua} onUnavailable={onUnavailable}/>}
    {!checked&&<div className="mt-4"><p className="mb-2 text-sm" style={{color:MUTED}}>Before the chat, choose the English meaning of this Mandarin expression.</p><MeaningQuiz pairs={lesson.template?.quizPairs ?? lesson.match} targetIndex={Math.max(0,target)} silent onMistake={onMistake} onUnavailable={onUnavailable} onComplete={()=>setChecked(true)}/></div>}
    {checked&&<PrimaryButton className="mt-6" data-testid="lesson-start-chat" onClick={onContinue}>Start the chat</PrimaryButton>}
  </div>;
}
