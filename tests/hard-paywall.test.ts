import {test,mock} from "node:test";
import assert from "node:assert/strict";
import {NextRequest} from "next/server";
import {middleware} from "../middleware";
import {requiredApiProduct,permitsProduct,PRE_PURCHASE_ONBOARDING_APIS} from "../lib/accessPolicy";
const denied=["/api/journey/generate","/api/journey/abc/start-island","/api/topic-islands/abc/lesson","/api/quiz/daily","/api/home/dashboard","/api/story/daily","/api/learn-chat","/api/onboarding/activate","/api/hsk/words","/api/hsk/journey/generate","/api/tts","/api/pronunciation/score","/api/sms/huahua"];
test("full learning APIs require a subscription; onboarding trials do not",()=>{
 for(const path of denied)assert.ok(requiredApiProduct(path),path);
 for(const path of ["/api/stripe/checkout","/api/stripe/webhook","/api/stripe/portal","/api/stripe/reconcile","/api/entitlements","/api/profile","/api/onboarding/progress","/api/onboarding/pronunciation","/api/onboarding/save-email","/api/sms/webhook","/api/hsk/waitlist"])assert.equal(requiredApiProduct(path),null,path);
 assert.equal(requiredApiProduct("/api/new-learning-endpoint"),"core");
 assert.equal(requiredApiProduct("/api/onboarding/activate/"),"core");
 assert.equal(permitsProduct({isIslandsPro:false,isHskPro:false},"either"),false);
 assert.equal(permitsProduct({isHskPro:true},"core"),false);
 assert.equal(permitsProduct({isIslandsPro:true},"hsk"),false);
 assert.equal(permitsProduct({isHskPro:true},"either"),true);
});
test("middleware rejects free and unauthenticated users before learning handlers run",async()=>{
 const stub=mock.method(globalThis,"fetch",async()=>Response.json({isIslandsPro:false,isHskPro:false}));
 try{
  for(const path of denied){const response=await middleware(new NextRequest(`https://lingoisland.com${path}`));assert.equal(response.status,403,path);}
  stub.mock.mockImplementation(async()=>new Response(null,{status:401}));
  assert.equal((await middleware(new NextRequest("https://lingoisland.com/api/tts"))).status,401);
  stub.mock.mockImplementation(async()=>{throw Error("offline")});
  assert.equal((await middleware(new NextRequest("https://lingoisland.com/api/tts"))).status,503);
 }finally{stub.mock.restore();}
});
test("middleware permits subscribers only for their product and keeps checkout reachable",async()=>{
 const stub=mock.method(globalThis,"fetch",async()=>Response.json({isIslandsPro:true,isHskPro:false}));
 try{
  for(const path of denied.filter(p=>requiredApiProduct(p)!=="hsk"))assert.equal((await middleware(new NextRequest(`https://lingoisland.com${path}`))).status,200,path);
  assert.equal((await middleware(new NextRequest("https://lingoisland.com/api/hsk/words"))).status,403);
  const before=stub.mock.callCount();await middleware(new NextRequest("https://lingoisland.com/api/stripe/checkout"));assert.equal(stub.mock.callCount(),before);
 }finally{stub.mock.restore();}
});
test("onboarding and HSK APIs stay product-isolated for cross-subscribed users",async()=>{
 const stub=mock.method(globalThis,"fetch",async()=>Response.json({isIslandsPro:false,isHskPro:true}));
 try{
  assert.equal((await middleware(new NextRequest("https://lingoisland.com/api/hsk/words"))).status,200);
  assert.equal((await middleware(new NextRequest("https://lingoisland.com/api/journey/generate"))).status,403);
  assert.equal((await middleware(new NextRequest("https://lingoisland.com/api/onboarding/activate"))).status,403);
  assert.equal((await middleware(new NextRequest("https://lingoisland.com/api/tts"))).status,200);
 }finally{stub.mock.restore();}
});

test("pre-purchase onboarding pronunciation reaches its authenticated handler without an entitlement lookup", async()=>{
 const stub=mock.method(globalThis,"fetch",async()=>{throw new Error("Onboarding must not require a subscription lookup");});
 try {
  const response=await middleware(new NextRequest("https://lingoisland.com/api/onboarding/pronunciation"));
  assert.equal(response.status,200);
  assert.equal(stub.mock.callCount(),0);
  assert.equal(requiredApiProduct("/api/pronunciation/score"),"either");
 } finally {stub.mock.restore();}
});

// Exercise the middleware, not just the handlers: that is where the regression occurred.
test("every pre-purchase onboarding API bypasses subscription lookup for guests and free users",async()=>{
 const stub=mock.method(globalThis,"fetch",async()=>{throw Error("No subscription lookup during onboarding");});
 try {
  for(const path of PRE_PURCHASE_ONBOARDING_APIS){
   for(const cookie of ["", "guest-session", "free-account-session"]){
    const response=await middleware(new NextRequest(`https://lingoisland.com${path}`,{headers:{cookie}}));
    assert.equal(response.status,200,path);
   }
   assert.equal(requiredApiProduct(`${path}/`),null,path);
   assert.ok(requiredApiProduct(`${path}/unlisted`),path);
  }
  assert.equal(stub.mock.callCount(),0);
 }finally{stub.mock.restore();}
});
test("guest writing and first-lesson requests reach task validation through middleware",async()=>{
 const stub=mock.method(globalThis,"fetch",async()=>{throw Error("Invalid tasks must not call providers");});
 try{
  const handlers=[
   ["/api/onboarding/writing",(await import("../app/api/onboarding/writing/route")).POST],
   ["/api/onboarding/first-lesson",(await import("../app/api/onboarding/first-lesson/route")).POST],
  ] as const;
  for(const [path,handler] of handlers){
   const request=new NextRequest(`https://lingoisland.com${path}`,{method:"POST",headers:{origin:"https://lingoisland.com","content-type":"application/json"},body:"{}"});
   assert.equal((await middleware(request)).status,200);
   assert.equal((await handler(request)).status,400);
  }
  assert.equal(stub.mock.callCount(),0);
 }finally{stub.mock.restore();}
});

test("an unsubscribed guest can receive a writing grade through the middleware and handler",async()=>{
 const previous=process.env.DEEPSEEK_API_KEY;process.env.DEEPSEEK_API_KEY="test";
 const calls:string[]=[];
 const stub=mock.method(globalThis,"fetch",async(input:unknown)=>{
  calls.push(String(input));
  assert.equal(String(input),"https://api.deepseek.com/v1/chat/completions");
  return Response.json({choices:[{message:{content:JSON.stringify({correct:true,feedback:"Your sentence works."})}}]});
 });
 try{
  const {POST}=await import("../app/api/onboarding/writing/route");
  const request=new NextRequest("https://lingoisland.com/api/onboarding/writing",{method:"POST",headers:{origin:"https://lingoisland.com","content-type":"application/json"},body:JSON.stringify({tier:4,goal:"heritage",variant:0,interestKeys:[],lessonId:"methods-v1-4-heritage-0",stepId:"practice:3",answer:"我想吃面条或者饺子"})});
  assert.equal((await middleware(request)).status,200);
  const response=await POST(request);
  assert.equal(response.status,200);
  assert.equal((await response.json()).status,"correct");
  assert.equal(calls.length,1);
 }finally{stub.mock.restore();if(previous===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=previous;}
});
