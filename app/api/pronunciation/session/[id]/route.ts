import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameOriginMutation } from "@/lib/security/sameOrigin";
import { withItemIds, validCheckpoint } from "@/lib/pronunciation/sessionProgress";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: session, error } = await supabase
    .from("pronunciation_sessions")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !session) {
    return NextResponse.json({ error: "Practice session not found" }, { status: 404 });
  }

  const { data: attempts } = await supabase
    .from("pronunciation_attempts")
    .select("id, item_id, unit_type, target_text, attempt_number, overall_score, weak_syllables, created_at")
    .eq("session_id", params.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ session:{...session,sentences:withItemIds(session.sentences??[])}, attempts: attempts ?? [] },{headers:{"Cache-Control":"no-store"}});
}

export async function PUT(request:Request,{params}:{params:{id:string}}) {
  if(!isSameOriginMutation(request))return NextResponse.json({error:"Invalid request origin."},{status:403});
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const body=await request.json().catch(()=>null);
  const {data:session,error}=await supabase.from("pronunciation_sessions").select("sentences,status,progress_revision").eq("id",params.id).eq("user_id",user.id).maybeSingle();
  if(error||!session)return NextResponse.json({error:"Session not found."},{status:404});
  if(session.status!=="in_progress")return NextResponse.json({error:"This session is already finished. Reload to continue."},{status:409});
  if(!Number.isInteger(body?.revision)||!validCheckpoint(body?.checkpoint,withItemIds(session.sentences??[])))return NextResponse.json({error:"Invalid practice progress."},{status:400});
  const {data:saved,error:saveError}=await supabase.from("pronunciation_sessions").update({progress:body.checkpoint,progress_revision:body.revision+1}).eq("id",params.id).eq("user_id",user.id).eq("progress_revision",body.revision).select("progress_revision").maybeSingle();
  if(saveError)return NextResponse.json({error:"Could not save practice. Please try again."},{status:503});
  if(!saved)return NextResponse.json({error:"This session changed in another tab. Reload to use the latest progress."},{status:409});
  return NextResponse.json({revision:saved.progress_revision});
}
