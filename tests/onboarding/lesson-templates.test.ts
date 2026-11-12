import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState, parseAnswers, parseFirstLesson } from "../../lib/onboarding/personalized/flow";
import { CHAT_TEMPLATES, compileTemplate, fallbackTemplatePlan, makeTemplatePlan, parseTemplatePlan, teachingWords, templateKey, templateTier, templateWords, validTemplatePlan } from "../../lib/onboarding/personalized/firstLesson/templates";
import { selectTemplate } from "../../lib/onboarding/personalized/firstLesson/template-model";
import { isLessonPronunciationTarget } from "../../lib/onboarding/personalized/firstLesson/bank";
const clean=(s:string)=>s.replace(/[，。！？、\s]/g,"");
const profile=()=>{const a=initialState(new Date()).answers;a.goal.primary="work";a.level.selfReport="few_words";return a;};
test("36 authored templates cover every goal and tier with consistent language metadata",()=>{
 for(const goal of ["work","school","heritage","travel","everyday","other"])assert.deepEqual(CHAT_TEMPLATES.filter(t=>t.goal===goal).map(t=>t.tier),[1,2,3,4,5,6]);
 for(const row of CHAT_TEMPLATES){
  assert.equal(clean([...row.prefix,...row.aWords,...row.suffix].map(w=>w.hanzi).join("")),clean(row.practice.hanzi),row.id);
  assert.equal(clean([...row.prefix,...row.bWords,...row.suffix].map(w=>w.hanzi).join("")),clean(row.transfer.hanzi),row.id);
  assert.equal(row.huahua.words.map(w=>w.hanzi).join(""),clean(row.huahua.hanzi),row.id);
  for(const w of [...templateWords(row),row.practice,row.transfer,row.huahua,row.closing]){assert.ok(w.meaning.length>0,row.id);assert.match(w.pinyin,/[a-zāáǎà]/i,row.id);}
  assert.ok(row.scene.length>20&&row.incomingNote.length>30,row.id);
  const plan={version:1 as const,key:"templates-v1-test",templateId:row.id,familiarWords:[] as string[],checked:true,patternFamiliar:false},lesson=compileTemplate(plan);
  for(const build of [lesson.build,lesson.transferBuild]){assert.ok(build.slotId);assert.ok(build.order.includes(build.slotId));assert.equal(clean(build.chunks.map(c=>c.label).join("")),clean(build.result.hanzi));assert.equal(new Set(build.order).size,build.order.length);}
  assert.equal(lesson.chat.expectedChoiceId,lesson.transferBuild.result.id);
  assert.ok(isLessonPronunciationTarget(clean(lesson.build.result.hanzi)));
  assert.ok(isLessonPronunciationTarget(clean(lesson.transferBuild.result.hanzi)));
 }
});
test("six self-report tiers remain distinct and fallbacks obey total unfamiliar budgets",()=>{
 const levels=["new","few_words","simple_sentences","basic_conversations","familiar_topics","complex_topics"] as const;
 for(const goal of ["work","school","heritage","travel","everyday","other"] as const)for(const [index,level] of Array.from(levels.entries())){
  const a=profile();a.goal.primary=goal;a.level.selfReport=level;assert.equal(templateTier(a),index+1);
  const plan=fallbackTemplatePlan(a),row=CHAT_TEMPLATES.find(t=>t.id===plan.templateId)!;
  assert.equal(row.tier,index+1,`${goal}/${level}`);assert.ok(teachingWords(plan).length<=(row.tier===1?5:3));assert.ok(validTemplatePlan(plan,a));
 }
});
test("reply is taught independently from familiar time choices and incoming when is prepared",()=>{
 const a=profile(),row=CHAT_TEMPLATES.find(t=>t.id==="work-2")!;
 const plan=makeTemplatePlan(a,row,templateWords(row).filter(w=>!["回复","什么时候"].includes(w.hanzi)).map(w=>w.hanzi)),lesson=compileTemplate(plan);
 assert.deepEqual(lesson.match.map(w=>w.hanzi),["回复","什么时候"]);
 assert.deepEqual(lesson.build.options?.map(w=>w.hanzi),["今天","明天"]);
 assert.deepEqual(lesson.template?.incomingTeaching.map(w=>w.hanzi),["什么时候"]);
});
test("beginners assemble words and every new foundation and incoming cue is planned",()=>{
 const a=profile();a.level.selfReport="new";const plan=fallbackTemplatePlan(a),lesson=compileTemplate(plan);
 assert.deepEqual(lesson.build.chunks.map(c=>c.label),["我","需要","时间"]);assert.equal(lesson.build.slotId,"slot-0");
 assert.deepEqual(new Set(teachingWords(plan).map(w=>w.hanzi)),new Set(["我","需要","时间","帮助","吗"]));
 assert.deepEqual(lesson.template?.incomingTeaching.map(w=>w.hanzi),["吗"]);
});
test("progress persists and malformed, stale, wrong-goal or harder plans are rejected",()=>{
 const a=profile(),plan=fallbackTemplatePlan(a);assert.deepEqual(parseFirstLesson({templatePlan:plan,teachingIndex:2}).templatePlan,plan);
 assert.equal(parseFirstLesson({teachingIndex:999}).teachingIndex,20);
 assert.equal(parseTemplatePlan({...plan,templateId:"untrusted"}),null);assert.equal(validTemplatePlan({...plan,key:"templates-v1-stale"},a),null);
 assert.equal(validTemplatePlan({...plan,templateId:"travel-1"},a),null);assert.equal(validTemplatePlan({...plan,templateId:"work-6"},a),null);
 assert.ok(!parseTemplatePlan({...plan,familiarWords:["<script>","未知"]})?.familiarWords.length);
});
test("provider selects only authored IDs, preserves privacy and falls back on bad output",async()=>{
 const a=profile();a.commitment.name="PRIVATE NAME";a.interests.custom="PRIVATE CUSTOM";
 const row=CHAT_TEMPLATES.find(t=>t.id==="work-2")!;let payload:any;
 const familiarWords=templateWords(row).filter(w=>!["回复","什么时候"].includes(w.hanzi)).map(w=>w.hanzi);
 const fetcher=(async(_url:any,options:any)=>{payload=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({templateId:row.id,familiarWords})}}]}));}) as typeof fetch;
 const result=await selectTemplate(a,[],{apiKey:"test",fetcher});assert.equal(result.reason,"ok");assert.equal(result.plan.templateId,"work-2");
 assert.ok(!JSON.stringify(payload).includes("PRIVATE"));assert.equal(payload.response_format.type,"json_object");
 const bad=(async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({templateId:"work-6",familiarWords})}}]}))) as typeof fetch;
 assert.equal((await selectTemplate(a,[],{apiKey:"test",fetcher:bad})).reason,"invalid");
 const noKey=await selectTemplate(a,[],{apiKey:null});assert.equal(noKey.reason,"no_key");assert.ok(validTemplatePlan(noKey.plan,a));
 a.level.selfReport="new";assert.equal((await selectTemplate(a,[],{apiKey:"test",fetcher})).reason,"beginner");
});
test("explicitly unrecognized words cannot be declared familiar by the model",()=>{
 const a=profile();a.vocabBasic={shownIds:["mingtian"],selectedIds:[],noneKnown:true};
 const row=CHAT_TEMPLATES.find(t=>t.id==="work-2")!,plan=makeTemplatePlan(a,row,templateWords(row).map(w=>w.hanzi));
 assert.ok(!plan.familiarWords.includes("明天"));assert.equal(validTemplatePlan({...plan,familiarWords:[...plan.familiarWords,"明天"]},a),null);
});
test("a new expression made from familiar words is not presented as a new pronoun",()=>{
 const a=profile(),row=CHAT_TEMPLATES.find(t=>t.id==="work-2")!,plan=makeTemplatePlan(a,row,templateWords(row).map(w=>w.hanzi)),lesson=compileTemplate(plan);
 assert.equal(lesson.template?.teaching[0].hanzi,row.practice.hanzi);assert.equal(lesson.template?.shortRoute,true);assert.notEqual(lesson.match[0].hanzi,"我");
});
test("client and server normalization give the same profile key",()=>{
 const a=profile();a.vocabBasic={shownIds:["ni","wo"],selectedIds:["wo","ni"],noneKnown:false};
 assert.equal(templateKey(a),templateKey(parseAnswers(a)));assert.equal(parseFirstLesson({teachingIndex:1.5}).teachingIndex,1);
});
test("a simpler fallback preserves words the learner explicitly said were unfamiliar",()=>{
 const a=profile(),plan=fallbackTemplatePlan(a,["work-2"],["我"]);
 assert.ok(!plan.familiarWords.includes("我"));assert.ok(teachingWords(plan).some(w=>w.hanzi==="我"));assert.ok(validTemplatePlan(plan,a));
});
