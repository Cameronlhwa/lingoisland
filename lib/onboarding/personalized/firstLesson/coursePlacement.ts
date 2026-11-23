import { COURSE_REVISION, NEW_ITEM_LIMIT, makeBudgetCourse, type BudgetCourse, type CourseTier } from "./budgetCourseContent";
import type { GoalKey } from "../goals";
export type CoursePlacement = {
 revision:typeof COURSE_REVISION; assessmentVersion:2; goal:GoalKey; requestedTier:CourseTier;
 tier:CourseTier; variant:number; status:"checking"|"probe"|"ready";
 evidence:Record<string,boolean>; checkedIds:string[]; mastered:CourseTier[]; visited:string[]; notice?:string;
};
const GOALS:GoalKey[]=["heritage","work","school","travel","everyday","other"];
export function placementTargetIds(course:BudgetCourse):string[]{
 return Array.from(new Set([...course.budget.grammarIds,...course.budget.topicIds])).slice(0,3);
}
export function placementFoundationIds(course:BudgetCourse):string[]{return course.budget.foundationIds??course.budget.prerequisiteIds;}
export function placementAssessmentWords(course:BudgetCourse){
 const ids=[...placementTargetIds(course),...placementFoundationIds(course)];
 return ids.flatMap(id=>{const w=course.match.find(w=>w.id===id);return w?[w]:[];});
}
export function beginPlacement(tier:CourseTier,goal:GoalKey,evidence:Record<string,boolean>={}):CoursePlacement{
 return {revision:COURSE_REVISION,assessmentVersion:2,goal,requestedTier:tier,tier,variant:0,status:"checking",evidence,checkedIds:[],mastered:[],visited:[]};
}
export const newItems=(course:BudgetCourse,evidence:Record<string,boolean>)=>course.budget.words.filter(w=>evidence[w.id]!==true);
/** The teaching budget is informational; unfamiliar target words never lower placement. */
export function courseNewItemLimit(course:BudgetCourse){return Math.max(NEW_ITEM_LIMIT,new Set([...course.budget.grammarIds,...course.budget.topicIds]).size);}
export function wordsToConfirm(course:BudgetCourse,evidence:Record<string,boolean>){return placementAssessmentWords(course).filter(w=>evidence[w.id]===undefined);}
export function fitsBudget(course:BudgetCourse,evidence:Record<string,boolean>){
 const foundations=placementFoundationIds(course);
 return !wordsToConfirm(course,evidence).length&&foundations.filter(id=>evidence[id]===false).length<=foundations.length/2;
}
export function placementWordsToShow(p:CoursePlacement){
 const checked=new Set(p.checkedIds);
 return placementAssessmentWords(makeBudgetCourse(p.tier,p.goal,p.variant)).filter(w=>!checked.has(w.id)||p.evidence[w.id]===undefined);
}
function ready(p:CoursePlacement,notice?:string):CoursePlacement{return {...p,status:"ready",notice};}
export function placeCourse(p:CoursePlacement):CoursePlacement{
 const course=makeBudgetCourse(p.tier,p.goal,p.variant);
 if(placementWordsToShow(p).length)return {...p,status:"checking"};
 const next={...p,visited:Array.from(new Set([...p.visited,`${p.tier}:${p.variant}`]))};
 if(!fitsBudget(course,p.evidence)&&p.tier>1){
  return {...next,tier:(p.tier-1) as CourseTier,variant:0,status:"checking",notice:"Let’s check a few foundations for an easier starting point. We’ve kept your earlier answers."};
 }
 if(placementTargetIds(course).every(id=>p.evidence[id]===true)&&!p.mastered.includes(p.tier))return {...next,status:"probe"};
 return ready(next,"We’ll teach the new lesson words and fill in any small gaps as you go.");
}
export function recordWordCheck(p:CoursePlacement,knownIds:readonly string[]):CoursePlacement{
 const visible=placementWordsToShow(p),known=new Set(knownIds),evidence={...p.evidence};
 for(const word of visible)evidence[word.id]=known.has(word.id);
 return placeCourse({...p,evidence,checkedIds:Array.from(new Set([...p.checkedIds,...visible.map(w=>w.id)]))});
}
export function finishGrammarProbe(p:CoursePlacement,passed:boolean):CoursePlacement{
 if(!passed)return ready(p,"Let’s practise this pattern with the words you know.");
 const mastered=Array.from(new Set([...p.mastered,p.tier]));
 if(p.tier<6)return {...p,mastered,tier:(p.tier+1) as CourseTier,variant:0,status:"checking",notice:"You’ve got this pattern. Let’s check the next useful step."};
 return ready({...p,mastered},"Let’s apply these patterns in a short discussion.");
}
export function parseCoursePlacement(raw:unknown):CoursePlacement|undefined{
 if(!raw||typeof raw!=="object")return;
 const v=raw as Record<string,unknown>;
 const validTier=(n:unknown):n is CourseTier=>Number.isInteger(n)&&Number(n)>=1&&Number(n)<=6;
 if(v.revision!==COURSE_REVISION||!GOALS.includes(v.goal as GoalKey)||!validTier(v.tier)||!validTier(v.requestedTier)||!["checking","probe","ready"].includes(String(v.status)))return;
 const evidence:Record<string,boolean>={};
 if(v.evidence&&typeof v.evidence==="object")for(const [id,value] of Object.entries(v.evidence).slice(0,200))if(/^[\u3400-\u9fff]{1,24}$/.test(id)&&typeof value==="boolean")evidence[id]=value;
 // Reassess old placements with the new rules; retain explicit familiarity answers.
 if(v.assessmentVersion!==2){const p=beginPlacement(v.requestedTier,v.goal as GoalKey,evidence);p.checkedIds=Object.keys(evidence);return placeCourse(p);}
 const checkedIds=Array.isArray(v.checkedIds)?Array.from(new Set(v.checkedIds.filter((id):id is string=>typeof id==="string"&&typeof evidence[id]==="boolean"))).slice(0,200):[];
 const mastered=Array.isArray(v.mastered)?v.mastered.filter(validTier):[];
 const visited=Array.isArray(v.visited)?v.visited.filter((id):id is string=>typeof id==="string"&&/^[1-6]:[01]$/.test(id)).slice(0,12):[];
 const p:CoursePlacement={...beginPlacement(v.requestedTier,v.goal as GoalKey,evidence),tier:v.tier,variant:v.variant===1?1:0,status:v.status as CoursePlacement["status"],checkedIds,mastered:Array.from(new Set(mastered)),visited:Array.from(new Set(visited)),notice:typeof v.notice==="string"?v.notice.slice(0,240):undefined};
 if(p.status!=="checking"){
  const assessed=placeCourse(p);
  if(p.status==="ready"&&p.mastered.includes(p.tier))return assessed;
  // A failed grammar check legitimately keeps the current lesson.
  if(p.status==="ready"&&assessed.status==="probe")return p;
  return assessed;
 }
 return p;
}
