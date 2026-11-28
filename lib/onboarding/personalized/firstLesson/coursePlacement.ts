import { COURSE_REVISION, NEW_ITEM_LIMIT, makeBudgetCourse, type BudgetCourse, type CourseTier } from "./budgetCourseContent";
import type { OnboardingAnswers } from "../flow";
import { firstLevelVariant, type FirstLevelVariant } from "../experiment";
import type { GoalKey } from "../goals";
export type CoursePlacement = {
 revision:typeof COURSE_REVISION; assessmentVersion:2; goal:GoalKey; requestedTier:CourseTier;
 tier:CourseTier; variant:number; status:"checking"|"probe"|"ready";
 wordCheckRounds?:number; firstLevelVariant?:FirstLevelVariant; evidence:Record<string,boolean>; checkedIds:string[]; mastered:CourseTier[]; visited:string[]; notice?:string;
};
function courseForPlacement(p:CoursePlacement) {
 return makeBudgetCourse(p.tier,p.goal,p.variant,{goal:{primary:p.goal},interests:{keys:[]},firstLevelVariant:p.firstLevelVariant??"control"} as unknown as OnboardingAnswers);
}
const GOALS:GoalKey[]=["heritage","work","school","travel","everyday","other"];
export function placementTargetIds(course:BudgetCourse):string[]{
 return Array.from(new Set([...course.budget.grammarIds,...course.budget.topicIds])).slice(0,3);
}
export function placementFoundationIds(course:BudgetCourse):string[]{return course.budget.foundationIds??course.budget.prerequisiteIds;}
export function placementAssessmentWords(course:BudgetCourse){
 const ids=[...placementTargetIds(course),...placementFoundationIds(course)];
 return ids.flatMap(id=>{const w=course.match.find(w=>w.id===id);return w?[w]:[];});
}
export function beginPlacement(tier:CourseTier,goal:GoalKey,evidence:Record<string,boolean>={},firstLevel:FirstLevelVariant="control"):CoursePlacement{
 return {revision:COURSE_REVISION,assessmentVersion:2,firstLevelVariant:firstLevel,goal,requestedTier:tier,tier,variant:0,status:"checking",wordCheckRounds:0,evidence,checkedIds:[],mastered:[],visited:[]};
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
 return placementAssessmentWords(courseForPlacement(p)).filter(w=>!checked.has(w.id)||p.evidence[w.id]===undefined);
}
function ready(p:CoursePlacement,notice?:string):CoursePlacement{return {...p,status:"ready",notice};}
export const MAX_WORD_CHECK_ROUNDS = 2;
function finishWordChecks(p:CoursePlacement):CoursePlacement {
 // Prefer demonstrated foundations, and never repeat a grammar pattern already passed.
 const floor = Math.min(6, Math.max(0, ...p.mastered) + 1) as CourseTier;
 let tier = Math.max(floor, p.tier) as CourseTier;
 while (tier > floor) {
  const foundations = placementFoundationIds(courseForPlacement({...p,tier}));
  if (foundations.filter(id=>p.evidence[id]===true).length >= foundations.length / 2) break;
  tier = (tier - 1) as CourseTier;
 }
 return ready({...p,tier,variant:tier===p.tier?p.variant:0},"We’ve found a starting point. We’ll teach any missing words as you go.");
}
export function placeCourse(p:CoursePlacement):CoursePlacement{
 if ((p.wordCheckRounds ?? 0) >= MAX_WORD_CHECK_ROUNDS) return finishWordChecks(p);
 // A saved older placement may have fallen back to a pattern already passed.
 if(p.tier<6&&p.mastered.includes(p.tier))return {...p,tier:(p.tier+1) as CourseTier,variant:0,status:"checking",notice:"You’ve already shown you can use that pattern. Let’s find your next step."};
 const course=courseForPlacement(p);
 if(placementWordsToShow(p).length)return {...p,status:"checking"};
 const next={...p,visited:Array.from(new Set([...p.visited,`${p.tier}:${p.variant}`]))};
 if(!fitsBudget(course,p.evidence)&&p.tier>1){
  // New supporting words at the next tier do not erase demonstrated grammar mastery.
  if(p.mastered.some(tier=>tier>=p.tier-1))return ready(next,"You’ve already passed the earlier pattern. We’ll keep the next step and teach the supporting words you need.");
  return {...next,tier:(p.tier-1) as CourseTier,variant:0,status:"checking",notice:"Let’s check a few foundations for an easier starting point. We’ve kept your earlier answers."};
 }
 if(placementTargetIds(course).every(id=>p.evidence[id]===true)&&!p.mastered.includes(p.tier))return {...next,status:"probe"};
 return ready(next,"We’ll teach the new lesson words and fill in any small gaps as you go.");
}
export function recordWordCheck(p:CoursePlacement,knownIds:readonly string[]):CoursePlacement{
 const visible=placementWordsToShow(p),known=new Set(knownIds),evidence={...p.evidence};
 for(const word of visible)evidence[word.id]=known.has(word.id);
 return placeCourse({...p,wordCheckRounds:Math.min(MAX_WORD_CHECK_ROUNDS,(p.wordCheckRounds??0)+(visible.length?1:0)),evidence,checkedIds:Array.from(new Set([...p.checkedIds,...visible.map(w=>w.id)]))});
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
 if(v.assessmentVersion!==2){const p=beginPlacement(v.requestedTier,v.goal as GoalKey,evidence,firstLevelVariant(v.firstLevelVariant));p.checkedIds=Object.keys(evidence);return placeCourse(p);}
 const checkedIds=Array.isArray(v.checkedIds)?Array.from(new Set(v.checkedIds.filter((id):id is string=>typeof id==="string"&&typeof evidence[id]==="boolean"))).slice(0,200):[];
 const mastered=Array.isArray(v.mastered)?v.mastered.filter(validTier):[];
 const visited=Array.isArray(v.visited)?v.visited.filter((id):id is string=>typeof id==="string"&&/^[1-6]:[01]$/.test(id)).slice(0,12):[];
 const wordCheckRounds=Number.isInteger(v.wordCheckRounds)&&Number(v.wordCheckRounds)>=0 ? Math.min(MAX_WORD_CHECK_ROUNDS,Number(v.wordCheckRounds)) : Math.min(MAX_WORD_CHECK_ROUNDS,visited.length);
 const p:CoursePlacement={...beginPlacement(v.requestedTier,v.goal as GoalKey,evidence,firstLevelVariant(v.firstLevelVariant)),tier:v.tier,wordCheckRounds,variant:v.variant===1?1:0,status:v.status as CoursePlacement["status"],checkedIds,mastered:Array.from(new Set(mastered)),visited:Array.from(new Set(visited)),notice:typeof v.notice==="string"?v.notice.slice(0,240):undefined};
 if(wordCheckRounds>=MAX_WORD_CHECK_ROUNDS)return placeCourse(p);
 if(p.status!=="checking"){
  const assessed=placeCourse(p);
  if(p.status==="ready"&&p.mastered.includes(p.tier))return assessed;
  // A failed grammar check legitimately keeps the current lesson.
  if(p.status==="ready"&&assessed.status==="probe")return p;
  return assessed;
 }
 return p;
}
