import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { generateLearnChat, ChatProviderError } from "../../lib/deepseek/learnChat";
import { buildJourneyChatPrompt } from "../../lib/journey/teaching/chatPrompt";
import { UNAVAILABLE_CHAT_PLACEHOLDER } from "../../lib/journey/teaching/chatReply";

const levels = ["A0", "A1", "A2", "B1", "B2", "C1"];
const input = { systemPrompt: "Return Mandarin JSON", messages: [{ role: "user" as const, content: "电脑" }], guidedReply: true };
async function withProvider(body: unknown, run: () => Promise<void>, status = 200) {
 const previous = process.env.DEEPSEEK_API_KEY;process.env.DEEPSEEK_API_KEY = "test-only";
 const stub = mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
  const payload = JSON.parse(String(init.body));
  assert.deepEqual(payload.thinking, { type: "disabled" });
  assert.ok(payload.max_tokens >= 1200);
  return new Response(JSON.stringify(body), { status });
 });
 try { await run(); } finally { stub.mock.restore();if(previous===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=previous; }
}
for (const level of levels) test(`${level} chat uses its level context and returns conversational Mandarin with hints`, async () => {
 const systemPrompt=buildJourneyChatPrompt({ level, topic: "Coffee", mission: "Talk about coffee", pattern: "想要", words: [{ hanzi: "咖啡", pinyin: "kāfēi", english: "coffee" }] },true);
 const previous=process.env.DEEPSEEK_API_KEY;process.env.DEEPSEEK_API_KEY="test-only";
 const stub=mock.method(globalThis,"fetch",async(_url: unknown,init:RequestInit)=>{
  const payload=JSON.parse(String(init.body));assert.match(payload.messages[0].content,new RegExp(`LEVEL: ${level}`));assert.deepEqual(payload.thinking,{type:"disabled"});assert.deepEqual(payload.response_format,{type:"json_object"});assert.equal(payload.messages.at(-1).content,"电脑");
  return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:JSON.stringify({message:"我也喜欢咖啡，你喜欢热的还是冰的？",suggestions:["热的","冰的"]})}}]}));
 });
 try { const reply=await generateLearnChat({...input,systemPrompt});assert.equal(reply.message,"我也喜欢咖啡，你喜欢热的还是冰的？");assert.deepEqual(reply.suggestions,["热的","冰的"]); }
 finally {stub.mock.restore();if(previous===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=previous;}
});
test("empty, reasoning-only, truncated and malformed replies fail instead of saving a fake response", async () => {
 for(const choice of [
  {finish_reason:"length",message:{content:"",reasoning_content:"Internal analysis"}},
  {finish_reason:"stop",message:{content:null,reasoning_content:"Internal analysis"}},
  {finish_reason:"stop",message:{content:"   "}},
  {finish_reason:"length",message:{content:'{"message":"你好"'}},
  {finish_reason:"stop",message:{content:'{"suggestions":["电脑"]}'}},
  {finish_reason:"stop",message:{content:UNAVAILABLE_CHAT_PLACEHOLDER}},
  {finish_reason:"stop",message:{content:JSON.stringify({message:UNAVAILABLE_CHAT_PLACEHOLDER,suggestions:[]})}},
 ]) await withProvider({choices:[choice]},async()=>{await assert.rejects(()=>generateLearnChat(input),(error:unknown)=>error instanceof ChatProviderError&&error.status===502&&!error.message.includes("Internal analysis"));});
});
test("provider failures remain retryable and legacy exercise responses keep their shape", async()=>{
 await withProvider({error:"Unavailable"},async()=>{await assert.rejects(()=>generateLearnChat(input),ChatProviderError);},503);
 await withProvider({choices:[{finish_reason:"stop",message:{content:'{"exchanges":[]}'}}]},async()=>{assert.deepEqual(await generateLearnChat({...input,guidedReply:false,exerciseMode:true}),{message:'{"exchanges":[]}'});});
});

test("blank JSON-mode output recovers once with consistent history and no JSON filter", async () => {
 const previous=process.env.DEEPSEEK_API_KEY;process.env.DEEPSEEK_API_KEY="test-only";
 let calls=0;
 const stub=mock.method(globalThis,"fetch",async(_url:unknown,init:RequestInit)=>{
  calls++;const payload=JSON.parse(String(init.body));
  assert.deepEqual(payload.thinking,{type:"disabled"});
  const oldAssistant=payload.messages.find((message:{role:string})=>message.role==="assistant");
  assert.deepEqual(JSON.parse(oldAssistant.content),{message:"你想喝咖啡吗？",suggestions:[]});
  assert.equal(payload.messages.at(-1).content,"喜欢");
  if(calls===1){assert.deepEqual(payload.response_format,{type:"json_object"});return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:"   "}}]}));}
  assert.equal(payload.response_format,undefined);
  return new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:'{"message":"我也喜欢，你喜欢热的还是冰的？","suggestions":["热的","冰的"]}'}}]}));
 });
 try {
  const reply=await generateLearnChat({...input,messages:[{role:"assistant",content:"你想喝咖啡吗？\n(Nǐ xiǎng hē kāfēi ma?)\nHint: answer ‘喜欢’."},{role:"user",content:"喜欢"}]});
  assert.equal(calls,2);assert.equal(reply.message,"我也喜欢，你喜欢热的还是冰的？");
 } finally {stub.mock.restore();if(previous===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=previous;}
});
