import {test,expect,type BrowserContext} from "@playwright/test";
import {createServer,type Server} from "node:http";
const free="00000000-0000-0000-0000-000000000001",paid="00000000-0000-0000-0000-000000000002";
let server:Server;
let writes=0;
test.describe.configure({mode:"serial"});
// Run only against the isolated preview configured with this local auth fixture.
test.beforeAll(async()=>{
 server=createServer((req,res)=>{
  res.setHeader('content-type','application/json');
  if(req.method!=="GET"){writes++;res.writeHead(403);res.end(JSON.stringify({message:"Fixture writes forbidden"}));return;}
  const url=new URL(req.url!,"http://127.0.0.1:54321");
  const token=(req.headers.authorization??'').replace('Bearer ','');
  let sub=free;try{sub=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub}catch{}
  if(url.pathname==='/auth/v1/user'){res.end(JSON.stringify({id:sub,aud:'authenticated',role:'authenticated',email:'fixture@example.test',is_anonymous:false,app_metadata:{provider:'email'},user_metadata:{},identities:[],created_at:new Date().toISOString()}));return;}
  if(url.pathname==='/rest/v1/profiles'){res.end(JSON.stringify([{id:sub,plan:sub===paid?'pro':'free',stripe_subscription_id:sub===paid?'sub_fixture':null,current_period_end:sub===paid?'2099-01-01T00:00:00Z':null,cancel_at_period_end:false}]));return;}
  if(url.pathname==='/rest/v1/product_subscriptions'){res.writeHead(404);res.end(JSON.stringify({code:'PGRST205',message:'Fixture legacy profile fallback'}));return;}
  res.end('[]');
 });
 await new Promise<void>(resolve=>server.listen(54321,'127.0.0.1',resolve));
});
test.afterAll(async()=>{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));});
async function login(context:BrowserContext,sub:string){
 const exp=Math.floor(Date.now()/1000)+3600;
 const jwt=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub,role:'authenticated',aud:'authenticated',exp})).toString('base64url')+'.fixture';
 const session={access_token:jwt,refresh_token:'fixture',expires_at:exp,expires_in:3600,token_type:'bearer',user:{id:sub,email:'fixture@example.test',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}}};
 await context.addCookies([{name:'sb-127-auth-token',value:encodeURIComponent(JSON.stringify(session)),domain:'127.0.0.1',path:'/'}]);
}

test('unpaid learning and activation requests are blocked without writes',async({context,page})=>{
 await login(context,free);const before=writes;
 for(const path of ['/api/onboarding/activate','/api/journey/generate','/api/journey/abc/start-island','/api/topic-islands/abc/lesson','/api/learn-chat','/api/tts','/api/quiz/answer','/api/sms/send']){
  const response=await context.request.post(path,{data:{stage:'complete'}});expect(response.status(),path).toBe(403);expect((await response.json()).code).toBe('PRODUCT_ACCESS_REQUIRED');
 }
 expect(writes).toBe(before);
 for(const path of ['/app','/app/onboarding?activate=1','/app?checkout=success']){
  await page.goto(path);await expect(page).toHaveURL(/\/onboarding\/journey\?resume=paywall/);
 }
});
test('subscribers pass the core access check and billing remains reachable',async({context})=>{
 await login(context,paid);
 // No GET handler exists: 405 proves the paid gate passed without running a mutation.
 expect((await context.request.get('/api/onboarding/activate')).status()).toBe(405);
 expect((await context.request.get('/api/hsk/words')).status()).toBe(403);
 await login(context,free);
 expect((await context.request.get('/api/entitlements')).status()).toBe(200);
 expect((await context.request.get('/api/stripe/checkout')).status()).toBe(405);
});
