"use client";
import {useState} from "react";
import type {MatchPair} from "@/lib/onboarding/personalized/firstLesson/types";
import {MatchWords} from "./LessonActivities";
import {MUTED} from "../ui";
export function MatchRounds({pairs,onComplete,onMistake,onUnavailable,initialRound=0,onProgress}:{initialRound?:number;onProgress:(round:number)=>void;pairs:MatchPair[];onComplete:()=>void;onMistake:(id:string)=>void;onUnavailable:()=>void}) {
 const [round,setRound]=useState(Math.min(initialRound,Math.ceil(pairs.length/4)-1));
 const size=4, count=Math.ceil(pairs.length/size);
 return <div data-testid="lesson-match-round" data-match-round={round}><p className="mb-3 text-center text-xs" style={{color:MUTED}}>Matching · {round+1} of {count}</p><MatchWords key={round} pairs={pairs.slice(round*size,(round+1)*size)} onMistake={onMistake} onUnavailable={onUnavailable} onComplete={()=>round+1<count?(setRound(round+1),onProgress(round+1)):onComplete()}/></div>;
}
