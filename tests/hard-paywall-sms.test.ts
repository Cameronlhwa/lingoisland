import {test} from "node:test";
import assert from "node:assert/strict";
import {respondToInbound} from "../lib/sms/huahua/conversation";
import {startHuahuaPreview} from "../lib/sms/huahua/preview";
import {sendHuahuaWelcome} from "../lib/sms/huahua/welcome";
import type {HuahuaDeps} from "../lib/sms/huahua/context";
import {getSmsConfig} from "../lib/sms/config";

function freeDeps(){
 let sends=0,modelCalls=0;
 const deps:HuahuaDeps={
  config:getSmsConfig({NODE_ENV:"test"}),
  rpc:async<T>(fn:string)=>{
   if(fn==='sms_get_user_context')return {contact:null,preferences:null,profile:null,billing:{plan:'free',current_period_end:null},subscriptions:[]} as T;
   if(fn==='sms_attach_inbound')return {thread:{id:'thread',origin:'preview',session:{preview:{stage:'greeting',learnerMessages:0}}},control_sent_at:null} as T;
   throw Error('Unexpected RPC: '+fn);
  },
  provider:{send:async()=>{sends++;throw Error('Must not send')}} as unknown as HuahuaDeps['provider'],
  generateTurn:async()=>{modelCalls++;throw Error('Must not generate')},
 };
 return {deps,sends:()=>sends,modelCalls:()=>modelCalls};
}
test('unpaid contacts receive no introduction, preview or practice reply',async()=>{
 const h=freeDeps();
 assert.equal((await startHuahuaPreview(h.deps,{userId:'user',contactId:'contact',channel:'sms'})).status,'skipped');
 assert.equal((await sendHuahuaWelcome(h.deps,'user','contact')).status,'skipped');
 const contact={id:'contact',user_id:'user',phone_number:'+14165550111',status:'active',display_name:null,paused_reason:null} as Parameters<typeof respondToInbound>[1]['contact'];
 for(const body of ['你好','PINYIN','TRANSLATE','HINT'])assert.equal(await respondToInbound(h.deps,{contact,inboundId:'inbound',body,ownNumber:'+14165550100'}),'subscription_required');
 assert.equal(h.sends(),0);assert.equal(h.modelCalls(),0);
});
