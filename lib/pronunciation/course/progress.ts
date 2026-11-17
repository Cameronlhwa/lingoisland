import { COURSE_ACTIVITIES, COURSE_VERSION, findActivity, type CourseActivity } from "./content";

export type ActivityProgress = { errors:number; resolved:boolean; firstCorrect?:boolean; selected?:number; completed:boolean; speaking:"not_attempted"|"scored"|"skipped"; attemptId?:string };
export type CourseProgress = { version:number; currentActivityId:string; activities:Record<string,ActivityProgress>; completedAt:string|null };
export type CourseAction =
  | {type:"visit";activityId:string}
  | {type:"answer";activityId:string;selected:number}
  | {type:"complete";activityId:string;skipSpeaking?:boolean}
  | {type:"scored";activityId:string;attemptId:string}
  | {type:"reset"};

export const emptyActivity = ():ActivityProgress=>({errors:0,resolved:false,completed:false,speaking:"not_attempted"});
export const initialCourseProgress = ():CourseProgress=>({version:COURSE_VERSION,currentActivityId:COURSE_ACTIVITIES[0].id,activities:{},completedAt:null});

/** Speakable steps only count toward mastery after a real recording, not a skip. */
export function isActivityMastered(activity: CourseActivity, entry: ActivityProgress | undefined): boolean {
  if (!entry?.completed) return false;
  if (activity.kind === "rule") return true;
  return entry.speaking === "scored";
}

export function isCourseMastered(progress: CourseProgress): boolean {
  return COURSE_ACTIVITIES.every((activity) => isActivityMastered(activity, progress.activities[activity.id]));
}

/** Drop a stale course-complete stamp when skips were counted as mastery. */
export function sanitizeCourseProgress(progress: CourseProgress): CourseProgress {
  if (!progress || progress.version !== COURSE_VERSION) return initialCourseProgress();
  const currentActivityId = findActivity(progress.currentActivityId)?.id ?? COURSE_ACTIVITIES[0].id;
  const activities: Record<string, ActivityProgress> = {};
  for (const [id, value] of Object.entries(progress.activities ?? {})) {
    if (!findActivity(id) || !value || typeof value !== "object") continue;
    activities[id] = {
      ...emptyActivity(),
      errors: Math.min(2, Math.max(0, Number(value.errors) || 0)),
      resolved: value.resolved === true,
      firstCorrect: typeof value.firstCorrect === "boolean" ? value.firstCorrect : undefined,
      selected: Number.isInteger(value.selected) ? value.selected : undefined,
      completed: value.completed === true,
      speaking: value.speaking === "scored" || value.speaking === "skipped" ? value.speaking : "not_attempted",
      attemptId: typeof value.attemptId === "string" ? value.attemptId : undefined,
    };
  }
  const next = { version: COURSE_VERSION, currentActivityId, activities, completedAt: progress.completedAt ?? null };
  return { ...next, completedAt: isCourseMastered(next) ? next.completedAt : null };
}

export function reduceCourseProgress(progress:CourseProgress, action:CourseAction, now=new Date().toISOString()):CourseProgress {
  if (action?.type === "reset") return initialCourseProgress();
  const base = sanitizeCourseProgress(progress);
  const activity=findActivity(action?.activityId);
  if(!activity||base.version!==COURSE_VERSION) throw new Error("This lesson is unavailable. Reload the course.");
  const current={...emptyActivity(),...base.activities[activity.id]};
  const next={...base,activities:{...base.activities},currentActivityId:activity.id};
  if(action.type==="answer") {
    if(!activity.options||!Number.isInteger(action.selected)||action.selected<0||action.selected>=activity.options.length)throw new Error("Choose one answer.");
    if(!current.resolved) {
      const correct=action.selected===activity.answer;
      if(current.firstCorrect===undefined)current.firstCorrect=correct;
      current.selected=action.selected;
      if(!correct)current.errors=Math.min(2,current.errors+1);
      current.resolved=correct||current.errors===2;
    }
  } else if(action.type==="scored") {
    if(activity.kind==="rule"||((activity.kind==="listen")&&!current.resolved))throw new Error("Finish the listening question before speaking.");
    if(typeof action.attemptId!=="string")throw new Error("Recording was not saved.");
    current.speaking="scored";current.attemptId=action.attemptId;
  } else if(action.type==="complete") {
    if(activity.options&&!current.resolved)throw new Error("Check your answer first.");
    if(activity.kind!=="rule"&&current.speaking!=="scored") {
      if(!action.skipSpeaking)throw new Error("Try speaking or choose to continue without speaking.");
      current.speaking="skipped";
    }
    current.completed=true;
    const index=COURSE_ACTIVITIES.findIndex(item=>item.id===activity.id);
    next.currentActivityId=COURSE_ACTIVITIES[index+1]?.id??activity.id;
  } else if(action.type!=="visit")throw new Error("Unknown course action.");
  next.activities[activity.id]=current;
  next.completedAt = isCourseMastered(next) ? (base.completedAt ?? now) : null;
  return next;
}

export function courseSummary(progress:CourseProgress) {
  const safe = sanitizeCourseProgress(progress);
  const rows = COURSE_ACTIVITIES.map((activity) => ({ activity, entry: safe.activities[activity.id] }));
  const quizzes = rows.filter(({ entry }) => entry?.firstCorrect !== undefined);
  const mastered = rows.filter(({ activity, entry }) => isActivityMastered(activity, entry)).length;
  const finished = rows.filter(({ entry }) => entry?.completed).length;
  return {
    completed: mastered,
    finished,
    total: COURSE_ACTIVITIES.length,
    speaking: rows.filter(({ entry }) => entry?.speaking === "scored").length,
    skipped: rows.filter(({ entry }) => entry?.completed && entry.speaking === "skipped").length,
    firstCorrect: quizzes.filter(({ entry }) => entry?.firstCorrect).length,
    questionsAnswered: quizzes.length,
    courseComplete: isCourseMastered(safe),
  };
}

export function unitMasteredCount(unitActivities: readonly CourseActivity[], progress: CourseProgress) {
  const safe = sanitizeCourseProgress(progress);
  return unitActivities.filter((activity) => isActivityMastered(activity, safe.activities[activity.id])).length;
}

export function safeCourseReturn(value:string|null):string {
  if(!value||!value.startsWith("/app/")||value.includes("\\")||value.includes("\n")||value.includes("\r"))return "/app/pronunciation/practice";
  try { const url=new URL(value,"https://local.invalid"); return url.origin==="https://local.invalid"&&(url.pathname.startsWith("/app/pronunciation/")||url.pathname.startsWith("/app/journey/"))&&!url.pathname.startsWith("/app/pronunciation/learn")?url.pathname+url.search:"/app/pronunciation/practice"; }catch{return "/app/pronunciation/practice";}
}
export function lessonForTone(tone:number|null, sandhi=false) {return sandhi?"tone-changes":tone===5?"neutral-tone":"four-tones";}
