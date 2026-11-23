import {test} from "node:test";
import assert from "node:assert/strict";
import {initialState,parseFirstLesson} from "../../lib/onboarding/personalized/flow";
import {updatedFirstLesson} from "../../lib/onboarding/personalized/firstLesson/curriculum";
import {makeBudgetCourse} from "../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
import {grammarSteps} from "../../lib/onboarding/personalized/firstLesson/grammarSequence";
import {reviewWriting} from "../../lib/onboarding/personalized/firstLesson/writing";
import {GOALS} from "../../lib/onboarding/personalized/goals";
for(const tier of [4,5,6] as const)test(`level ${tier}: active courses use the specified testing methods for every topic and variant`,()=>{
 for(const goal of GOALS)for(const variant of [0,1]){
  const lesson=makeBudgetCourse(tier,goal.key,variant),c=lesson.curriculum!;
  const expected=tier===4?["writing","writing","writing","writing","reading","choice","choice","choice"]:tier===5?["writing","writing","reading","choice","choice","writing","writing"]:["reading","choice","writing","writing"];
  assert.deepEqual(c.practices.map(p=>p.kind),expected);
  assert.equal(grammarSteps(c).filter(s=>s.kind==="check").length,0);
  assert.ok(!c.practices.some(p=>p.kind==="build"));
  assert.equal(c.pronunciation,tier===4);assert.equal(c.vocabularyMatching,true);
  assert.equal(c.vocabularyGroups[1].wordIds.length,tier===4?3:tier===5?4:2);
  for(const p of c.practices){
   if(p.kind==="writing")assert.equal(reviewWriting(p,p.sample.hanzi).status,"correct",`${lesson.id}: ${p.prompt}`);
   if(p.kind==="choice"){assert.ok(p.reading);assert.equal(p.choices.filter(w=>w.id===p.correct).length,1);}
  }
  if(tier===4){
   const tasks=c.practices.filter(p=>p.kind==="writing");
   assert.ok(tasks[2].required.includes("还是"));assert.ok(tasks[3].required.includes("或者"));
   for(const word of ["还是","或者","更"])assert.ok(c.practices.find(p=>p.kind==="reading")!.reading.text.includes(word));
  }
  if(tier===5){
   for(const p of c.practices.slice(0,2)){assert.equal(p.kind,"writing");if(p.kind==="writing")for(const term of ["除了","以外","还"])assert.ok(p.required.includes(term));}
   assert.ok(c.practices.slice(-2).every(p=>p.kind==="writing"&&!!p.reading));
  }
  if(tier===6){
   const reading=c.practices[0];assert.equal(reading.kind,"reading");if(reading.kind==="reading"){
    const count=(reading.reading.text.match(/[\u3400-\u9fff]/g)||[]).length;assert.ok(count>=100&&count<=150,`${goal.key}: ${count}`);
    for(const term of ["一方面","另一方面","在我看来","从","的角度来看","然而"])assert.ok(reading.reading.text.includes(term));
   }
   const passage=c.practices[3];assert.equal(passage.kind,"writing");if(passage.kind==="writing"){
    assert.equal(passage.minSentences,2);assert.equal(passage.maxSentences,3);
    for(const word of c.vocabularyGroups[1].wordIds)assert.ok(passage.required.includes(word));
   }
   assert.ok(c.discussion);assert.notEqual(c.discussion.huahua.hanzi,lesson.chat.huahua.hanzi);
   assert.ok(c.discussion.responses[c.discussion.expectedChoiceId!]);
  }
 }
});
test("selected interests reach the active story and old drafts cannot reuse the revised course checkpoints",()=>{
 const a=initialState(new Date(),"test").answers;a.level.selfReport="complex_topics";a.goal.primary="work";a.interests.keys=["technology"];
 const l=updatedFirstLesson(a)!;assert.ok(l.id.startsWith("methods-v1-6-"));
 const reading=l.curriculum!.practices.find(p=>p.kind==="reading")!.reading;
 assert.ok(reading.text.includes("新技术"));
 const p=parseFirstLesson({phase:"discussion",writingResponses:{"practice:1":"我的看法。","<script>":"bad","practice:2":"中".repeat(900)}});
 assert.equal(p.writingResponses!["practice:2"].length,600);assert.equal(p.writingResponses!["<script>"],undefined);
});

test("viewpoint examples highlight both sides of the split grammar pattern",()=>{
 for(const goal of GOALS)for(const variant of [0,1]){
  const cards=makeBudgetCourse(6,goal.key,variant).curriculum!.cards;
  const examples=cards.flatMap(card=>card.examples).filter(e=>/在[^，。！？]*看来/.test(e.hanzi));
  assert.ok(examples.length);
  for(const example of examples){
   assert.ok(example.keyWords?.includes("在"),example.hanzi);
   assert.ok(example.keyWords?.includes("看来"),example.hanzi);
  }
 }
});
