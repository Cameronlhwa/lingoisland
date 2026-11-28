import {test,mock} from "node:test";
import assert from "node:assert/strict";
import {NextRequest} from "next/server";
import {middleware} from "../middleware";
import {requiredApiProduct,permitsProduct} from "../lib/accessPolicy";
const denied=["/api/journey/generate","/api/journey/abc/start-island","/api/topic-islands/abc/lesson","/api/quiz/daily","/api/home/dashboard","/api/story/daily","/api/learn-chat","/api/onboarding/activate","/api/onboarding/first-lesson","/api/onboarding/writing","/api/hsk/words","/api/hsk/placement-checklist","/api/hsk/onboarding-answers","/api/hsk/journey/generate","/api/hsk/curriculum/generate","/api/tts","/api/pronunciation/score","/api/sms/huahua"];
test("all learning APIs including prior previews require a subscription",()=>{
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
