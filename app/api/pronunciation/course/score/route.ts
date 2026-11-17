import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {COURSE_VERSION,findActivity} from "@/lib/pronunciation/course/content";
import {scoreWithSpeechSuper,SpeechSuperError} from "@/lib/speechsuper/client";
import {normalizeSpeechSuperResult} from "@/lib/pronunciation/normalizeScore";
import {weakSyllablesFromCharacters} from "@/lib/pronunciation/isolateTarget";
import {checkAndIncrementUsage} from "@/lib/pronunciation/rateLimit";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function POST(request:Request) {
  if(process.env.TONE_COURSE_ENABLED==="false")return NextResponse.json({error:"Tone Mastery is temporarily unavailable."},{status:503});
  const origin=request.headers.get("origin");
  if((origin&&origin!==new URL(request.url).origin)||request.headers.get("sec-fetch-site")==="cross-site")return NextResponse.json({error:"Invalid request origin."},{status:403});
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const form=await request.formData().catch(()=>null);
  const activity=findActivity(String(form?.get("courseActivityId")??""));
  const audio=form?.get("audio");const requestId=String(form?.get("clientRequestId")??"");
  if(!activity||activity.kind==="rule"||!(audio instanceof File)||!audio.size||audio.size>15*1024*1024||!/^[0-9a-f-]{36}$/i.test(requestId))return NextResponse.json({error:"Invalid course recording."},{status:400});
  if(activity.kind==="listen"){
    const {data:p}=await supabase.from("tone_course_progress").select("state").eq("user_id",user.id).eq("version",COURSE_VERSION).maybeSingle();
    if(!p?.state?.activities?.[activity.id]?.resolved)return NextResponse.json({error:"Check the listening answer before speaking."},{status:400});
  }
  const respond=(row:{id:string;score:ReturnType<typeof normalizeSpeechSuperResult>;overall_score:number|null})=>NextResponse.json({attemptId:row.id,score:row.score,overallScore:row.overall_score,weakSyllables:weakSyllablesFromCharacters(row.score.characters??[])});
  const existing=await supabase.from("tone_course_attempts").select("id,score,overall_score").eq("user_id",user.id).eq("version",COURSE_VERSION).eq("activity_id",activity.id).eq("client_request_id",requestId).maybeSingle();
  if(existing.data)return respond(existing.data);
  const appKey=process.env.SPEECHSUPER_APP_KEY,secretKey=process.env.SPEECHSUPER_SECRET_KEY;
  if(!appKey||!secretKey)return NextResponse.json({error:"Pronunciation checking is temporarily unavailable. You can continue without speaking."},{status:503});
  try{
    const usage=await checkAndIncrementUsage(supabase,user.id);
    if(!usage.ok)return NextResponse.json({error:"Daily pronunciation practice limit reached. You can continue without speaking."},{status:429});
    const raw=await scoreWithSpeechSuper({appKey,secretKey,userId:user.id,mode:Array.from(activity.text).length>1?"sentence":"word",referenceText:activity.text,audio:new Blob([await audio.arrayBuffer()],{type:"audio/wav"})});
    const normalized=normalizeSpeechSuperResult(raw,activity.text);
    const {data,error}=await supabase.from("tone_course_attempts").insert({user_id:user.id,version:COURSE_VERSION,activity_id:activity.id,client_request_id:requestId,target_text:activity.text,score:normalized,overall_score:normalized.overall}).select("id,score,overall_score").single();
    if(data)return respond(data);
    if(error?.code==="23505"){
      const {data:raced}=await supabase.from("tone_course_attempts").select("id,score,overall_score").eq("user_id",user.id).eq("version",COURSE_VERSION).eq("activity_id",activity.id).eq("client_request_id",requestId).single();
      if(raced)return respond(raced);
    }
    return NextResponse.json({error:"Could not save your recording result. Please try again."},{status:503});
  }catch(error){return NextResponse.json({error:error instanceof SpeechSuperError?error.message:"Could not check this recording. You can retry or continue without speaking."},{status:error instanceof SpeechSuperError?error.status:503});}
}
