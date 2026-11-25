import assert from "node:assert/strict";
import { test, mock } from "node:test";
import { createVocabularyPolicy, vocabularyViolations, assertVocabulary, VocabularyPolicyError } from "../../lib/journey/teaching/vocabularyPolicy";
import { learnedIslandIds, loadJourneyVocabulary } from "../../lib/journey/teaching/vocabularyHistory";
import { generateJourneyGrammar, validGrammarVocabulary } from "../../lib/journey/teaching/grammarGeneration";
import { generateLearnChat } from "../../lib/deepseek/learnChat";
import { generateWordSentences } from "../../lib/deepseek/generate-word-sentences";
import { selectObjective } from "../../lib/journey/teaching/curriculum";
import type { LessonClient } from "../../lib/journey/teaching/store";

const policy = createVocabularyPolicy("A2", ["合伙人"], ["创业"], "能");
test("the selected ceiling permits only taught and completed-journey exceptions", () => {
 assert.deepEqual(vocabularyViolations("创业初期，你能找到合适的合伙人吗？", policy), ["初期", "合适"]);
 assert.deepEqual(vocabularyViolations("你能和朋友一起工作吗？",policy),[]);
 assert.deepEqual(vocabularyViolations("你能找到人帮你吗？",policy),[]);
 assert.deepEqual(vocabularyViolations("我想要一杯咖啡。",policy),[]);
 assert.deepEqual(vocabularyViolations("我在咖啡店喝水。",policy),[]);
 assert.deepEqual(vocabularyViolations("我买了T恤。",createVocabularyPolicy("A2",["T恤"])),[]);
 assert.ok(vocabularyViolations("创业",createVocabularyPolicy("A2",["业"])).includes("创业"));
 assert.ok(vocabularyViolations("合伙人",createVocabularyPolicy("A2",["人"])).includes("合伙人"));
 assert.deepEqual(vocabularyViolations("这个那个，一点儿。因为我有水，所以喝水。虽然小，但是很好。",createVocabularyPolicy("A1",[])),[]);
 assert.deepEqual(vocabularyViolations("华华，你好！",createVocabularyPolicy("A0",[])),[]);
 assert.throws(()=>assertVocabulary(["创业初期。"],createVocabularyPolicy("A2",[])),VocabularyPolicyError);
});
test("all six levels use the same HSK 2.0 mapping and cumulative vocabulary",()=>{
 for(const [index,level] of Array.from(["A0","A1","A2","B1","B2","C1"].entries())){
  const selected=createVocabularyPolicy(level,[]);assert.equal(selected.hskLevel,index+1);assert.deepEqual(vocabularyViolations("你好，我喝水。",selected),[]);
 }
 assert.ok(vocabularyViolations("创业",createVocabularyPolicy("B2",[])).length);
 assert.deepEqual(vocabularyViolations("创业",createVocabularyPolicy("C1",[])),[]);
 assert.throws(()=>createVocabularyPolicy("invalid",[]));
});
test("only earlier completed lessons and completed owned journeys can contribute words",()=>{
 const journeys=[{id:"current",completed_at:null},{id:"past",completed_at:"done"},{id:"unfinished",completed_at:null}];
 const nodes=[
  {journey_id:"current",step_order:1,island_id:"earlier",completed_at:"done"},
  {journey_id:"current",step_order:2,island_id:"uncompleted",completed_at:null},
  {journey_id:"current",step_order:4,island_id:"future",completed_at:"done"},
  {journey_id:"past",step_order:1,island_id:"past-word",completed_at:"done"},
  {journey_id:"past",step_order:102,island_id:"story",completed_at:"done"},
  {journey_id:"unfinished",step_order:1,island_id:"other-unfinished",completed_at:"done"},
  {journey_id:"someone-else",step_order:1,island_id:"foreign",completed_at:"done"},
 ];
 assert.deepEqual(learnedIslandIds(journeys,nodes,{journey_id:"current",step_order:3,island_id:"now"}),["earlier","past-word"]);
 assert.throws(()=>learnedIslandIds([],nodes,{journey_id:"current",step_order:3,island_id:"now"}));
});

function fakeDb(failWords=false) {
 const tables:Record<string,any[]>={journeys:[{id:"current",user_id:"owner",completed_at:null},{id:"past",user_id:"owner",completed_at:"done"},{id:"foreign",user_id:"other",completed_at:"done"}],journey_islands:[
 {id:"a",journey_id:"current",island_id:"now",step_order:2,completed_at:null},
 {id:"b",journey_id:"current",island_id:"before",step_order:1,completed_at:"done"},
 {id:"c",journey_id:"current",island_id:"future",step_order:3,completed_at:null},
 {id:"d",journey_id:"past",island_id:"past",step_order:1,completed_at:"done"},
 {id:"e",journey_id:"foreign",island_id:"other",step_order:1,completed_at:"done"},
 ],journey_lessons:[{island_id:"past",user_id:"owner",content:{words:[{hanzi:"宁可"}]},progress:{stepId:"complete"}}],island_words:[{id:"a",user_id:"owner",island_id:"before",hanzi:"订阅"},{id:"b",user_id:"owner",island_id:"past",hanzi:"创业"},{id:"c",user_id:"owner",island_id:"future",hanzi:"初期"},{id:"d",user_id:"other",island_id:"other",hanzi:"合适"}]};
 return {from(table:string){let rows=[...tables[table]];const query:any={select(){return query},eq(key:string,value:unknown){rows=rows.filter(row=>row[key]===value);return query},in(key:string,values:unknown[]){rows=rows.filter(row=>values.includes(row[key]));return query},not(key:string){rows=rows.filter(row=>row[key]!=null);return query},order(){return query},range(start:number,end:number){return Promise.resolve({data:rows.slice(start,end+1),error:failWords&&table==="island_words"?{}:null})},maybeSingle(){return Promise.resolve({data:rows[0]??null,error:null})}};return query}} as unknown as LessonClient;
}
test("database history remains owner-scoped and fails closed when it cannot be loaded",async()=>{
 const policy=await loadJourneyVocabulary(fakeDb(),"owner","now","A2",["合伙人"],"能");
 assert.deepEqual(policy.learnedWords,["订阅","创业","宁可"]);
 await assert.rejects(()=>loadJourneyVocabulary(fakeDb(true),"owner","now","A2",[],"能"));
 await assert.rejects(()=>loadJourneyVocabulary(fakeDb(),"other","now","A2",[],"能"));
});
async function withProvider(run:()=>Promise<void>,answer:(payload:any)=>unknown){
 const previous=process.env.DEEPSEEK_API_KEY;process.env.DEEPSEEK_API_KEY="test-only";
 const stub=mock.method(globalThis,"fetch",async(_url:unknown,init:RequestInit)=>new Response(JSON.stringify({choices:[{finish_reason:"stop",message:{content:JSON.stringify(answer(JSON.parse(String(init.body))))}}]})));
 try{await run()}finally{stub.mock.restore();if(previous===undefined)delete process.env.DEEPSEEK_API_KEY;else process.env.DEEPSEEK_API_KEY=previous}
}
const example=(hanzi:string)=>({hanzi,pinyin:"nǐ néng",english:"Can you?",tier:"warmup" as const});
const point=(hanzi:string)=>({hanzi:"能",pinyin:"néng",english:"can",pattern:"能",whenToUse:"Circumstances",examples:[example(hanzi),{...example(hanzi),tier:"target" as const}] as [ReturnType<typeof example>,ReturnType<typeof example>&{tier:"target"}]});
test("grammar regenerates unapproved vocabulary and validates reusable examples",async()=>{
 let calls=0;
 const selected=createVocabularyPolicy("A2",["合伙人"],[],"能");
 await withProvider(async()=>{const result=await generateJourneyGrammar("Business",selectObjective("A2",1),selected);assert.equal(result.examples[0].hanzi,"你能找到合伙人吗？");assert.equal(calls,2)},payload=>{
  calls++;if(calls===2)assert.match(payload.messages[1].content,/初期/);
  return {points:[point(calls===1?"创业初期，你能找到合适的合伙人吗？":"你能找到合伙人吗？")]};
 });
 assert.equal(validGrammarVocabulary(point("创业初期，你能找到合伙人吗？") as any,selected),false);
});
test("chat validates suggested replies too, and rewrites advanced supporting words",async()=>{
 let calls=0;
 await withProvider(async()=>{const reply=await generateLearnChat({systemPrompt:"Chat in Mandarin",messages:[{role:"user",content:"你好"}],guidedReply:true,vocabularyPolicy:createVocabularyPolicy("A2",["合伙人"],[],"能")});assert.equal(reply.message,"你能找到合伙人吗？");assert.equal(calls,2)},payload=>{calls++;if(calls===2)assert.match(payload.messages[0].content,/创业/);return calls===1?{message:"你能找到合伙人吗？",suggestions:["创业初期。"]}:{message:"你能找到合伙人吗？",suggestions:["能。","不能。"]}});
});
test("all sentence tiers obey the supporting vocabulary ceiling",async()=>{
 await withProvider(async()=>{await assert.rejects(()=>generateWordSentences({word:{hanzi:"合伙人",pinyin:"héhuǒrén",english:"partner"},topic:"Business",level:"A2",vocabularyPolicy:createVocabularyPolicy("A2",["合伙人"])}),VocabularyPolicyError)},()=>({sentences:["easy","same","hard"].map(tier=>({tier,hanzi:tier==="hard"?"创业初期，你能找到合伙人吗？":"你能找到合伙人吗？",pinyin:"nǐ néng",english:"Can you?"}))}));
});
