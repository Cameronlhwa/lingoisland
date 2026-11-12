import {NextResponse} from "next/server";
import {SESSION_COOKIE,SESSION_SECONDS,createTestingSession,passwordMatches} from "@/lib/testing/auth";
import {TESTING_EMAIL} from "@/lib/testing/config";
import {isSameOriginMutation} from "@/lib/security/sameOrigin";
export const runtime="nodejs";
const attempts=new Map<string,{count:number;expires:number}>();
export async function POST(request:Request){
  if(!isSameOriginMutation(request))return NextResponse.json({error:"Invalid request origin."},{status:403});
  const key=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"local";
  const now=Date.now();
  for(const [ip,item] of Array.from(attempts.entries()))if(item.expires<=now)attempts.delete(ip);
  const bucket=attempts.get(key)??{count:0,expires:now+15*60*1000};
  if(bucket.count>=10||(!attempts.has(key)&&attempts.size>=1000))return NextResponse.json({error:"Too many attempts. Try again later."},{status:429});
  bucket.count++;attempts.set(key,bucket);
  const secret=process.env.TESTING_SESSION_SECRET,hash=process.env.TESTING_LOGIN_PASSWORD_HASH;
  if(!secret||secret.length<32||!hash)return NextResponse.json({error:"Testing sign-in has not been configured."},{status:503});
  let body;
  try{const raw=await request.text();if(raw.length>2048)throw new Error();body=JSON.parse(raw);}catch{return NextResponse.json({error:"Invalid request."},{status:400});}
  if(typeof body?.email!=="string"||typeof body?.password!=="string"||body.password.length>128)return NextResponse.json({error:"The email or password is incorrect."},{status:401});
  const valid=await passwordMatches(body.password,hash);
  if(!valid||body.email.trim().toLowerCase()!==TESTING_EMAIL)return NextResponse.json({error:"The email or password is incorrect."},{status:401});
  attempts.delete(key);
  const response=NextResponse.json({status:"signed_in"});
  response.headers.set("Cache-Control","no-store");
  response.cookies.set(SESSION_COOKIE,createTestingSession(secret),{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:SESSION_SECONDS});
  return response;
}
export async function DELETE(request:Request){
  if(!isSameOriginMutation(request))return NextResponse.json({error:"Invalid request origin."},{status:403});
  const response=NextResponse.json({status:"signed_out"});response.cookies.set(SESSION_COOKIE,"",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:0});return response;
}
