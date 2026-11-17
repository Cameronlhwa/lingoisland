import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSameOriginMutation } from "@/lib/security/sameOrigin";
export const dynamic="force-dynamic";
export async function POST(request:Request,{params}:{params:{id:string}}) {
  if(!isSameOriginMutation(request))return NextResponse.json({error:"Invalid request origin."},{status:403});
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {data,error}=await supabase.rpc("complete_pronunciation_session",{p_session_id:params.id});
  if(error)return NextResponse.json({error:/Finish each|no practice items|abandoned/.test(error.message)?error.message:"Could not save completion. Please try again."},{status:409});
  return NextResponse.json({summary:data});
}
