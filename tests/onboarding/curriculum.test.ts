import {test} from "node:test";
import assert from "node:assert/strict";
import {initialState,parseAnswers} from "../../lib/onboarding/personalized/flow";
import {updatedFirstLesson,isUpdatedPronunciationTarget} from "../../lib/onboarding/personalized/firstLesson/curriculum";
for(const level of ["new","few_words","simple_sentences"] as const)test(`${level}: fixed grammar with goal-specific words and valid builds`,()=>{
 const results=[];
 for(const goal of ["work","school","heritage","travel","everyday","other"] as const){
  const a=initialState(new Date(),"test").answers;a.level.selfReport=level;a.goal.primary=goal;
  // Recognition results must not replace the grammar for the selected level.
  a.vocabBasic={shownIds:["hui","neng"],selectedIds:["hui","neng"],noneKnown:false};
  const l=updatedFirstLesson(a)!;assert.ok(l.curriculum);
  assert.deepEqual(new Set(l.curriculum.vocabularyGroups.flatMap(g=>g.wordIds)),new Set(l.match.map(w=>w.id)));
  assert.equal(l.curriculum.vocabularyGroups.flatMap(g=>g.wordIds).length,l.match.length);assert.equal(l.template!.tier,["new","few_words","simple_sentences"].indexOf(level)+1);
  assert.ok(l.match.some(w=>w.hanzi===(level==="new"?"好":level==="few_words"?"会":"能")));
  if(level==="few_words"){assert.ok(!l.match.some(w=>w.hanzi==="说"));assert.match(l.transferBuild.result.pinyin,/bú huì/);}
  for(const p of l.curriculum!.practices)if(p.kind==="build"){
   assert.equal(p.build.order.map(id=>p.build.chunks.find(c=>c.id===id)!.label).join(""),p.build.result.hanzi);
   assert.equal(new Set(p.build.order).size,p.build.order.length);
  }
  for(const target of [...l.targets,...l.chat.choices])assert.ok(isUpdatedPronunciationTarget(target.hanzi));
  assert.equal(l.chat.choices.filter(p=>p.id===l.chat.expectedChoiceId).length,1);
  results.push(l);
 }
 assert.equal(new Set(results.map(l=>JSON.stringify(l.curriculum!.cards[0].explanation))).size,1);
 // Core explanation is shared; examples in the greeting discovery can be personalized.
});
test("all six self-reported levels use authored courses and retain note progress",()=>{
 const a=initialState(new Date()).answers;a.level.selfReport="complex_topics";assert.equal(updatedFirstLesson(a)!.template!.tier,6);
 a.firstLesson={...a.firstLesson,lessonId:"curriculum-v1-1-heritage",phase:"note"};
 assert.equal(parseAnswers(a).firstLesson.phase,"note");
});
