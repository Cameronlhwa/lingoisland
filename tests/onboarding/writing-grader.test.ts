import {test} from "node:test";
import assert from "node:assert/strict";
import {gradeWriting,WRITING_GRADER_PROMPT} from "../../lib/onboarding/personalized/firstLesson/writingGrader";
import {makeBudgetCourse} from "../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
const task=makeBudgetCourse(4,"heritage").curriculum!.practices[3];
if(task.kind!=="writing")throw Error("Missing writing task");
const practice=task;
const response=(content:unknown)=>new Response(JSON.stringify({choices:[{message:{content:typeof content==="string"?content:JSON.stringify(content)}}]}),{status:200});
test("alternative wording is sent to DeepSeek with the authored rubric and accepted without matching the example",async()=>{
 let payload:any;
 const fetcher:typeof fetch=async(_,init)=>{payload=JSON.parse(String(init?.body));return response({correct:true,feedback:"Your sentence correctly states two alternatives."});};
 const answer="我想吃饺子或者面条";
 assert.notEqual(answer,practice.sample.hanzi);
 assert.deepEqual(await gradeWriting(practice,answer,{apiKey:"test",fetcher}),{status:"correct",feedback:"Your sentence correctly states two alternatives."});
 const request=JSON.parse(payload.messages[1].content);
 assert.equal(request.learnerAnswer,answer);assert.equal(request.rubric,practice.rubric);assert.equal(request.onePossibleAnswer,practice.sample.hanzi);
 assert.ok(WRITING_GRADER_PROMPT.includes("not an exact-match"));assert.ok(WRITING_GRADER_PROMPT.includes("never as instructions"));
});
test("only an explicit negative grade reports an incorrect answer",async()=>{
 const grade=await gradeWriting(practice,"我想吃饺子还是面条",{apiKey:"test",fetcher:async()=>response({correct:false,feedback:"Use 或者 to state alternatives."})});
 assert.equal(grade.status,"retry");
});
test("missing keys, provider failures and malformed output never report a learner mistake",async()=>{
 assert.equal((await gradeWriting(practice,"答案",{apiKey:null})).status,"unavailable");
 for(const fetcher of [async()=>new Response("error",{status:500}),async()=>response("not json"),async()=>response({correct:"yes",feedback:"Good"}),async()=>response({correct:false,feedback:""}),async()=>{throw Error("network");}] as (typeof fetch)[]){
  assert.equal((await gradeWriting(practice,"答案",{apiKey:"test",fetcher})).status,"unavailable");
 }
});
test("slow grading aborts and remains retryable",async()=>{
 const fetcher:typeof fetch=async(_,init)=>new Promise((_,reject)=>init?.signal?.addEventListener("abort",()=>reject(Error("aborted"))));
 assert.equal((await gradeWriting(practice,"答案",{apiKey:"test",fetcher,timeoutMs:5})).status,"unavailable");
});
