import type { DrillItem } from "@/lib/deepseek/generate-pronunciation-drill";
import type { ScoreResult } from "@/components/app/Pronunciation/RecordButton";
import type { IsolateTarget } from "./isolateTarget";

export type SessionPhase="sound-tip"|"word-before"|"word-feedback"|"sentence-before"|"sentence-feedback"|"isolate-before"|"isolate-feedback"|"complete";
export type SessionCheckpoint={itemId:string;phase:SessionPhase;wordResult:ScoreResult|null;sentenceResult:ScoreResult|null;isolateSyllable:IsolateTarget|null;isolateResult:ScoreResult|null};
export type SessionAttempt={id?:string;item_id?:string|null;unit_type:string;target_text:string;overall_score:number|null;created_at?:string};
export function withItemIds<T extends DrillItem>(items:T[]) {return items.map((item,index)=>({...item,itemId:`item-${index}`}));}
export function startingPhase(item:DrillItem|undefined):SessionPhase {return item?.focusSyllable?"sound-tip":"word-before";}
export function resumeSession(items:ReturnType<typeof withItemIds>, attempts:SessionAttempt[], checkpoint?:SessionCheckpoint|null) {
  if(checkpoint&&checkpoint.phase!=="complete"){
    const index=items.findIndex(item=>item.itemId===checkpoint.itemId);
    if(index>=0)return {itemIndex:index,phase:checkpoint.phase,done:false,checkpoint};
  }
  // Legacy attempts can only match by text. Consume occurrences rather than
  // using a Set, so duplicate prompts never silently complete multiple items.
  const consumed=new Set<number>();
  for(let index=0;index<items.length;index++) {
    const item=items[index];
    const sentence=attempts.findIndex((a,i)=>!consumed.has(i)&&a.unit_type==="sentence"&&(a.item_id?a.item_id===item.itemId:a.target_text===item.sentenceHanzi));
    if(sentence>=0){consumed.add(sentence);continue;}
    const word=attempts.some(a=>a.unit_type==="word"&&(a.item_id?a.item_id===item.itemId:a.target_text===item.wordHanzi));
    return {itemIndex:index,phase:word?"sentence-before" as SessionPhase:startingPhase(item),done:false,checkpoint:null};
  }
  return {itemIndex:Math.max(0,items.length-1),phase:"sentence-feedback" as SessionPhase,done:true,checkpoint:null};
}
export function sessionAverage(attempts:SessionAttempt[]) {
  const latest=new Map<string,number|null>();
  for(const attempt of attempts)if(attempt.unit_type==="sentence")latest.set(attempt.item_id??attempt.target_text,attempt.overall_score);
  const values=Array.from(latest.values()).filter((value):value is number=>typeof value==="number"&&Number.isFinite(value));
  return values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length*10)/10:null;
}
export function validCheckpoint(value:unknown,items:ReturnType<typeof withItemIds>):value is SessionCheckpoint {
  if(!value||typeof value!=="object")return false;
  const p=value as SessionCheckpoint;
  if(!items.some(item=>item.itemId===p.itemId)||!["sound-tip","word-before","word-feedback","sentence-before","sentence-feedback","isolate-before","isolate-feedback"].includes(p.phase))return false;
  if(p.phase==="word-feedback"&&!p.wordResult)return false;
  if(p.phase==="sentence-feedback"&&!p.sentenceResult)return false;
  if(p.phase.startsWith("isolate")&&!p.isolateSyllable)return false;
  if(p.phase==="isolate-feedback"&&!p.isolateResult)return false;
  return JSON.stringify(p).length<100_000;
}
