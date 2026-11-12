import { NextResponse } from "next/server";
import { parseAnswers } from "@/lib/onboarding/personalized/flow";
import { isSameOriginMutation } from "@/lib/security/sameOrigin";
import { selectTemplate } from "@/lib/onboarding/personalized/firstLesson/template-model";
import { CHAT_TEMPLATES, fallbackTemplatePlan, templateKey, type TemplatePlan } from "@/lib/onboarding/personalized/firstLesson/templates";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const cache = new Map<string,{until:number;plan:TemplatePlan}>();
const pending = new Map<string,Promise<{plan:TemplatePlan;reason:string}>>();
const hits = new Map<string,{count:number;until:number}>();
export async function POST(request:Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({error:"Forbidden"},{status:403});
  if (Number(request.headers.get("content-length"))>100000) return NextResponse.json({error:"Request too large"},{status:413});
  const raw=await request.text(); if(raw.length>100000)return NextResponse.json({error:"Request too large"},{status:413});
  let body;try{body=JSON.parse(raw);}catch{return NextResponse.json({error:"Invalid request"},{status:400});}
  if(!body||typeof body!=="object")return NextResponse.json({error:"Invalid request"},{status:400});
  const answers=parseAnswers(body.profile);
  if(!answers.goal.primary||!answers.level.selfReport)return NextResponse.json({error:"Answers incomplete"},{status:400});
  const excluded=Array.isArray(body.exclude)?body.exclude.filter((id:unknown):id is string=>typeof id==="string"&&CHAT_TEMPLATES.some(t=>t.id===id)).slice(0,6):[];
  const key=`${templateKey(answers)}:${excluded.join(",")}`,now=Date.now();
  cache.forEach((v,k)=>{if(v.until<=now)cache.delete(k);});hits.forEach((v,k)=>{if(v.until<=now)hits.delete(k);});
  const cached=cache.get(key);if(cached)return NextResponse.json({plan:cached.plan,reason:"cached"});
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||request.headers.get("x-real-ip")||"unknown";
  const hit=hits.get(ip)??{count:0,until:now+3600000};hit.count++;hits.set(ip,hit);
  if(hits.size>5000)hits.delete(hits.keys().next().value!);
  if(hit.count>20)return NextResponse.json({plan:fallbackTemplatePlan(answers,excluded),reason:"limited"});
  let job=pending.get(key);
  if(!job){job=selectTemplate(answers,excluded);pending.set(key,job);}
  try{const result=await job;if(cache.size>=500)cache.delete(cache.keys().next().value!);cache.set(key,{until:Date.now()+3600000,plan:result.plan});return NextResponse.json(result);}
  finally{pending.delete(key);}
}
