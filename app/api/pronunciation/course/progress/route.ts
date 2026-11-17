import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {isSameOriginMutation} from "@/lib/security/sameOrigin";
import {COURSE_VERSION} from "@/lib/pronunciation/course/content";
import {initialCourseProgress,reduceCourseProgress,sanitizeCourseProgress,type CourseAction} from "@/lib/pronunciation/course/progress";
export const dynamic="force-dynamic";
export async function GET() {
  if(process.env.TONE_COURSE_ENABLED==="false")return NextResponse.json({error:"Tone Mastery is temporarily unavailable."},{status:503});
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {data,error}=await supabase.from("tone_course_progress").select("state,revision").eq("user_id",user.id).eq("version",COURSE_VERSION).maybeSingle();
  if(error)return NextResponse.json({error:"Could not load your course progress. Please try again."},{status:503});
  const progress=sanitizeCourseProgress(data?.state??initialCourseProgress());
  const ids=Object.values(progress.activities).flatMap((value)=>value.attemptId?[value.attemptId]:[]);
  const {data:attempts}=ids.length?await supabase.from("tone_course_attempts").select("id,activity_id,overall_score,score").eq("user_id",user.id).in("id",ids):{data:[]};
  return NextResponse.json({progress,revision:data?.revision??0,attempts:attempts??[]},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(request:Request) {
  if(!isSameOriginMutation(request))return NextResponse.json({error:"Invalid request origin."},{status:403});
  if(process.env.TONE_COURSE_ENABLED==="false")return NextResponse.json({error:"Tone Mastery is temporarily unavailable."},{status:503});
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await request.json().catch(()=>null);
  if(!body?.action||!Number.isInteger(body.revision)||body.revision<0)return NextResponse.json({error:"Invalid course action."},{status:400});
  const {data:row,error}=await supabase.from("tone_course_progress").select("state,revision").eq("user_id",user.id).eq("version",COURSE_VERSION).maybeSingle();
  if(error)return NextResponse.json({error:"Could not save your lesson. Please retry."},{status:503});
  if((row?.revision??0)!==body.revision)return NextResponse.json({error:"Progress changed in another tab. Reload to continue from your latest save."},{status:409});
  const action=body.action as CourseAction;
  if(action.type==="scored"){
    const {data:attempt}=await supabase.from("tone_course_attempts").select("id").eq("id",action.attemptId).eq("user_id",user.id).eq("version",COURSE_VERSION).eq("activity_id",action.activityId).maybeSingle();
    if(!attempt)return NextResponse.json({error:"This recording could not be verified. Try again."},{status:400});
  }
  let progress;try{progress=reduceCourseProgress(row?.state??initialCourseProgress(),action);}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Invalid course action."},{status:400});}
  const payload={user_id:user.id,version:COURSE_VERSION,revision:body.revision+1,state:progress,updated_at:new Date().toISOString()};
  const saved=row?await supabase.from("tone_course_progress").update(payload).eq("user_id",user.id).eq("version",COURSE_VERSION).eq("revision",body.revision).select("revision").maybeSingle():await supabase.from("tone_course_progress").insert(payload).select("revision").maybeSingle();
  if(saved.error||!saved.data)return NextResponse.json({error:saved.error?.code==="23505"?"Progress changed in another tab. Reload to continue.":"Could not save your lesson. Please retry."},{status:saved.error?.code==="23505"?409:503});
  return NextResponse.json({progress,revision:saved.data.revision});
}
