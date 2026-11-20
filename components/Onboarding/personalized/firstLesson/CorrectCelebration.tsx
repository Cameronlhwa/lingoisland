"use client";
import {useRef,useState} from "react";
import ScoreCelebration from "@/components/app/Pronunciation/ScoreCelebration";
/** Ephemeral success event: never saved with lesson progress or replayed on resume. */
export function CorrectCelebration(){
 const anchor=useRef<HTMLDivElement>(null);
 const [event]=useState(()=>({attemptId:`lesson-${crypto.randomUUID()}`,overallScore:100,newlyScored:true}));
 return <div ref={anchor}><ScoreCelebration result={event} anchorRef={anchor}/></div>;
}
