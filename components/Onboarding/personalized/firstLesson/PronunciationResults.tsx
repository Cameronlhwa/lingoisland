"use client";
import { useState } from "react";
import type { SpeakingAttempt, LessonPhrase } from "@/lib/onboarding/personalized/firstLesson/types";
import { alignedPronunciationPieces, pronunciationBand } from "@/lib/onboarding/personalized/firstLesson/pronunciationResults";
import { contextualToneTarget } from "@/lib/pronunciation/surfacePinyin";
import { toneShapeTip } from "@/lib/pronunciation/encouragement";
import { GREEN, MUTED, NAVY, SKY_PALE } from "../ui";
import { AudioButton } from "./LessonActivities";

const bands = {
  clear: {color:GREEN,background:"#EDF7F0",label:"Clear",icon:"✓"},
  close: {color:"#805B13",background:"#FFF5D9",label:"Almost there",icon:"◐"},
  practice: {color:"#A64231",background:"#FFF0EA",label:"Practise",icon:"↻"},
  unscored: {color:MUTED,background:"#EFF2F4",label:"Not assessed",icon:"?"},
};
export function PronunciationResults({attempt, phrase, onUnavailable}:{attempt:SpeakingAttempt;phrase:LessonPhrase;onUnavailable:()=>void}) {
  const pieces = alignedPronunciationPieces(phrase.hanzi, attempt.characters);
  const weakest = pieces.reduce((best,p,index) => p.score !== null && (pieces[best]?.score == null || p.score < pieces[best].score!) ? index : best, 0);
  const [selected,setSelected] = useState(weakest);
  const focused = pieces[selected];
  const hanziIndices = Array.from(phrase.hanzi).flatMap((char, index) => /[\u3400-\u9fff]/.test(char) ? [index] : []);
  const offset = pieces.slice(0, selected).reduce((count, piece) => count + Array.from(piece.hanzi).length, 0);
  const context = contextualToneTarget(phrase.hanzi, hanziIndices[offset] ?? -1);
  const tip = focused && Array.from(focused.hanzi).length === 1 ? toneShapeTip(focused.targetTone, {previousTone:focused.previousTone ?? (context?.targetTone === focused.targetTone ? context.previousTone : null), connectedSpeech:context?.connectedSpeech}) : null;
  const scored = pieces.some(p => p.score !== null);
  return <div data-testid="pronunciation-results" aria-live="polite">
    <p className="mb-4 text-base font-semibold" style={{color:NAVY}}>{phrase.meaning}</p>
    <div className="flex flex-wrap justify-center gap-2">
      {pieces.map((piece,index) => {const band=bands[pronunciationBand(piece.score)];return <button key={index} type="button" data-testid={`pronunciation-piece-${index}`} data-band={pronunciationBand(piece.score)} aria-pressed={selected===index} aria-label={`${piece.hanzi}: ${band.label}`} onClick={()=>setSelected(index)} className="min-w-12 max-w-20 flex-1 rounded-2xl border-2 px-2 py-2 text-center focus-visible:outline focus-visible:outline-2" style={{background:band.background,color:band.color,borderColor:selected===index?band.color:"transparent"}}>
        <span className="block text-2xl font-bold" lang="zh-CN">{piece.hanzi}</span>
        <span className="mt-1 block text-xs">{piece.pinyin ?? "—"}</span>

      </button>;})}
    </div>
    {!scored && <p className="mt-3 text-sm" style={{color:MUTED}}>We could not assess these sounds reliably. Listen back or continue.</p>}
    {focused && <div className="mt-3 rounded-2xl px-4 py-3 text-sm leading-relaxed" style={{background:SKY_PALE,color:NAVY}}>
      <p className="font-semibold" lang="zh-CN">{focused.hanzi} · {focused.pinyin ?? "—"}</p>
      <p className="mt-1">{focused.score===null ? "This part was not assessed reliably. Listen to the model, then try it in the sentence." : focused.score>=80 ? "This part came through clearly. Listen again if you want to practise." : tip ?? "Listen to the model and focus on this part. Then try it again in the whole sentence."}</p>
      <AudioButton text={phrase.hanzi} label="Hear sentence" onUnavailable={onUnavailable}/>
    </div>}
  </div>;
}
