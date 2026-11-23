import {NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {isSameOriginMutation} from "@/lib/security/sameOrigin";
import {makeBudgetCourse} from "@/lib/onboarding/personalized/firstLesson/budgetCourseContent";
import {grammarSteps} from "@/lib/onboarding/personalized/firstLesson/grammarSequence";
import {gradeWriting,type WritingGrade} from "@/lib/onboarding/personalized/firstLesson/writingGrader";
import {initialState} from "@/lib/onboarding/personalized/flow";
import {GOALS} from "@/lib/onboarding/personalized/goals";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const cache=new Map<string,{until:number;grade:WritingGrade}>();
const hits=new Map<string,{until:number;count:number}>();
export async function POST(request:Request){
 if(!isSameOriginMutation(request))return NextResponse.json({error:"Forbidden"},{status:403});
 if(Number(request.headers.get("content-length"))>8000)return NextResponse.json({error:"Request too large"},{status:413});
 const raw=await request.text();if(raw.length>8000)return NextResponse.json({error:"Request too large"},{status:413});
 let body;try{body=JSON.parse(raw);}catch{return NextResponse.json({error:"Invalid request"},{status:400});}
 if(!body||typeof body!=="object"||![4,5,6].includes(body.tier)||!GOALS.some(g=>g.key===body.goal)||![0,1].includes(body.variant)||typeof body.stepId!=="string"||typeof body.answer!=="string"||!body.answer.trim()||body.answer.length>600)return NextResponse.json({error:"Invalid writing task"},{status:400});
 const profile=initialState(new Date(),"test").answers;profile.goal.primary=body.goal;
 profile.interests.keys=Array.isArray(body.interestKeys)?body.interestKeys.filter((key:unknown):key is string=>typeof key==="string"&&key.length<=40).slice(0,12):[];
 const lesson=makeBudgetCourse(body.tier,body.goal,body.variant,profile);
 const step=grammarSteps(lesson.curriculum!).find(step=>step.id===body.stepId);
 if(lesson.id!==body.lessonId||!step||step.kind==="teach"||step.practice.kind!=="writing")return NextResponse.json({error:"Unknown writing task"},{status:400});
 // Task and rubric come from authored server content, never client-supplied grading instructions.
 const key=createHash("sha256").update(JSON.stringify([step.practice,body.answer])).digest("hex"),now=Date.now();
 cache.forEach((v,k)=>{if(v.until<=now)cache.delete(k);});hits.forEach((v,k)=>{if(v.until<=now)hits.delete(k);});
 const cached=cache.get(key);if(cached)return NextResponse.json(cached.grade);
 const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||request.headers.get("x-real-ip")||"unknown";
 const hit=hits.get(ip)??{until:now+600000,count:0};hit.count++;hits.set(ip,hit);
 if(hits.size>2000)hits.delete(hits.keys().next().value!);
 if(hit.count>60)return NextResponse.json({status:"unavailable",feedback:"Please wait a moment before checking another answer."},{status:429});
 const grade=await gradeWriting(step.practice,body.answer);
 if(grade.status!=="unavailable"){if(cache.size>=300)cache.delete(cache.keys().next().value!);cache.set(key,{until:Date.now()+300000,grade});}
 return NextResponse.json(grade,{status:grade.status==="unavailable"?503:200});
}
