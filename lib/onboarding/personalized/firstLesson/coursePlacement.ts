import { COURSE_REVISION, NEW_ITEM_LIMIT, makeBudgetCourse, type BudgetCourse, type CourseTier } from "./budgetCourseContent";
import type { GoalKey } from "../goals";

export type CoursePlacement = {
 revision: typeof COURSE_REVISION; goal: GoalKey; requestedTier: CourseTier;
 tier: CourseTier; variant: number; status: "checking" | "probe" | "ready";
 evidence: Record<string, boolean>; mastered: CourseTier[]; visited: string[];
 notice?: string;
};
const GOALS: GoalKey[]=["heritage","work","school","travel","everyday","other"];
export function parseCoursePlacement(raw: unknown): CoursePlacement | undefined {
 if(!raw||typeof raw!=="object")return;
 const v=raw as Record<string,unknown>;
 const validTier=(n:unknown):n is CourseTier=>Number.isInteger(n)&&Number(n)>=1&&Number(n)<=6;
 if(v.revision!==COURSE_REVISION||!GOALS.includes(v.goal as GoalKey)||!validTier(v.tier)||!validTier(v.requestedTier)||!["checking","probe","ready"].includes(String(v.status)))return;
 const evidence:Record<string,boolean>={};
 if(v.evidence&&typeof v.evidence==="object")for(const [id,value] of Object.entries(v.evidence).slice(0,200))if(/^[\u3400-\u9fff]{1,24}$/.test(id)&&typeof value==="boolean")evidence[id]=value;
 const visited=Array.isArray(v.visited)?v.visited.filter((id):id is string=>typeof id==="string"&&/^[1-6]:[01]$/.test(id)).slice(0,12):[];
 const mastered=Array.isArray(v.mastered)?v.mastered.filter(validTier):[];
 const result:CoursePlacement={revision:COURSE_REVISION,goal:v.goal as GoalKey,requestedTier:v.requestedTier,tier:v.tier,variant:v.variant===1?1:0,status:v.status as CoursePlacement["status"],evidence,mastered:Array.from(new Set(mastered)),visited:Array.from(new Set(visited)),notice:typeof v.notice==="string"?v.notice.slice(0,240):undefined};
 // A stored ready flag alone cannot bypass the budget or the familiarity check.
 if(result.status==="ready"&&!fitsBudget(makeBudgetCourse(result.tier,result.goal,result.variant),result.evidence))result.status="checking";
 return result;
}
export function beginPlacement(tier:CourseTier,goal:GoalKey,evidence:Record<string,boolean>={}):CoursePlacement {
 return {revision:COURSE_REVISION,goal,requestedTier:tier,tier,variant:0,status:"checking",evidence,mastered:[],visited:[]};
}
export const newItems=(course:BudgetCourse,evidence:Record<string,boolean>)=>course.budget.words.filter(w=>evidence[w.id]!==true);
export function fitsBudget(course:BudgetCourse,evidence:Record<string,boolean>) {
 return course.budget.words.every(w=>typeof evidence[w.id]==="boolean")&&newItems(course,evidence).length<=NEW_ITEM_LIMIT;
}
export function wordsToConfirm(course:BudgetCourse,evidence:Record<string,boolean>) {
 return course.budget.words.filter(w=>evidence[w.id]===undefined);
}
function ready(p:CoursePlacement,notice?:string):CoursePlacement{return {...p,status:"ready",notice};}
/** Choose among authored variants using explicit evidence, not vocabulary level as a grammar proxy. */
export function placeCourse(p:CoursePlacement):CoursePlacement {
 const course=makeBudgetCourse(p.tier,p.goal,p.variant);
 if(wordsToConfirm(course,p.evidence).length)return {...p,status:"checking"};
 const key=`${p.tier}:${p.variant}`,visited=Array.from(new Set([...p.visited,key]));
 const next={...p,visited};
 if(!fitsBudget(course,p.evidence)){
  // Try a same-grammar alternative only if already-reported unknown words can fit.
  // Untested words may turn out familiar, but explicitly unfamiliar words cannot disappear.
  const alternative=1-p.variant,alternateCourse=makeBudgetCourse(p.tier,p.goal,alternative);
  const definiteUnknown=alternateCourse.budget.words.filter(w=>p.evidence[w.id]===false).length;
  if(visited.length<3&&definiteUnknown<=NEW_ITEM_LIMIT&&!visited.includes(`${p.tier}:${alternative}`))return {...next,variant:alternative,status:"checking",notice:"Let’s find some more familiar words for this lesson."};
  // Pick the highest earlier course that fits even if every untested word is unfamiliar.
  // This avoids walking the learner through every level and another large word checklist.
  for(let tier=p.tier-1;tier>=1;tier--)for(const variant of [0,1]){
   const candidate=makeBudgetCourse(tier as CourseTier,p.goal,variant);
   if(p.mastered.includes(tier as CourseTier))continue;
   if(newItems(candidate,p.evidence).length<=NEW_ITEM_LIMIT){
    const evidence={...p.evidence};candidate.budget.words.forEach(w=>{if(evidence[w.id]===undefined)evidence[w.id]=false;});
    const fitted={...next,tier:tier as CourseTier,variant,evidence};
    if(!newItems(candidate,evidence).length&&!p.mastered.includes(tier as CourseTier))return {...fitted,status:"probe"};
    return ready(fitted,"We found a gentler starting point. We’ll teach the unfamiliar words before you use them.");
   }
  }
  // The five-item greeting course is a safe starting point for every goal.
  const starter=makeBudgetCourse(1,p.goal),evidence={...p.evidence};starter.match.forEach(w=>{if(evidence[w.id]===undefined)evidence[w.id]=false;});
  const lastMastered=p.mastered.filter(t=>t<p.tier).sort((a,b)=>b-a)[0];
  if(lastMastered){const familiar=makeBudgetCourse(lastMastered,p.goal);const known={...p.evidence};familiar.match.forEach(w=>{if(known[w.id]===undefined)known[w.id]=false;});
   if(newItems(familiar,known).length<=NEW_ITEM_LIMIT)return ready({...next,tier:lastMastered,variant:0,evidence:known},"Let’s apply the pattern you know in a short conversation.");}
  return ready({...next,tier:1,variant:0,evidence},"Let’s start with a short greeting you can use in your chosen topic.");
 }
 const unknownTopics=course.budget.topicIds.filter(id=>p.evidence[id]!==true);
 if(!unknownTopics.length&&!visited.includes(`${p.tier}:${1-p.variant}`))return {...next,variant:1-p.variant,status:"checking",notice:"Let’s find two useful words for your topic."};
 // Known words do not imply grammar mastery. No lesson is skipped without a grammar check.
 if(!newItems(course,p.evidence).length&&!p.mastered.includes(p.tier))return {...next,status:"probe"};
 return ready(next,p.tier!==p.requestedTier?"This lesson fits what you know. Your topic stays the same.":undefined);
}
export function recordWordCheck(p:CoursePlacement,knownIds:readonly string[]):CoursePlacement {
 const course=makeBudgetCourse(p.tier,p.goal,p.variant),known=new Set(knownIds),evidence={...p.evidence};
 // The latest explicit response wins, including reversing an earlier known answer.
 for(const w of course.budget.words)evidence[w.id]=known.has(w.id);
 return placeCourse({...p,evidence});
}
export function finishGrammarProbe(p:CoursePlacement,passed:boolean):CoursePlacement {
 if(!passed)return ready(p,"You know the words. Let’s practise using this pattern.");
 const mastered=Array.from(new Set([...p.mastered,p.tier]));
 for(let tier=p.tier+1;tier<=6;tier++)if(!mastered.includes(tier as CourseTier))return {...p,mastered,tier:tier as CourseTier,variant:0,status:"checking",notice:"You’ve got this pattern. Let’s find your next useful step."};
 return ready({...p,mastered},"You know these patterns. Here’s a short application lesson using familiar language.");
}
