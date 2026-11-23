import {test} from "node:test";
import assert from "node:assert/strict";
import {unfamiliarVocabulary,vocabularyBatch,groupedVocabularyBatch,orderedVocabulary} from "../../lib/onboarding/personalized/firstLesson/vocabulary";
import {parseFirstLesson} from "../../lib/onboarding/personalized/flow";
import {makeBudgetCourse,type CourseTier} from "../../lib/onboarding/personalized/firstLesson/budgetCourseContent";
import {GOALS} from "../../lib/onboarding/personalized/goals";
const words=Array.from({length:11},(_,i)=>({id:`word-${i}`,hanzi:`词${i}`,pinyin:"cí",label:`meaning ${i}`,visual:"word"}));
test("known words are excluded; every remaining word is taught once in groups of at most three",()=>{
 for(let size=0;size<=words.length;size++){
  const input=words.slice(0,size),known=input.filter((_,i)=>i%2===0).map(w=>w.id);
  const unknown=unfamiliarVocabulary(input,known),taught=[];
  for(let i=0;i<unknown.length;i+=3){const batch=vocabularyBatch(unknown,i);assert.ok(batch.length>0&&batch.length<=3);taught.push(...batch);}
  assert.deepEqual(taught, input.filter(w=>!known.includes(w.id)));
 }
});
test("a partially taught batch retains the same three words until its test finishes",()=>{
 assert.deepEqual(vocabularyBatch(words,0),vocabularyBatch(words,1));
 assert.deepEqual(vocabularyBatch(words,1),vocabularyBatch(words,2));
 assert.deepEqual(vocabularyBatch(words,3).map(w=>w.id),["word-3","word-4","word-5"]);
});
test("familiarity selection and the pending batch test survive normalized progress",()=>{
 const saved=parseFirstLesson({version:2,phase:"vocabulary",vocabularyKnownIds:["会","会",null,42,"做饭"],vocabularyChecked:true,vocabularyTesting:true,vocabularyIndex:5});
 assert.deepEqual(saved.vocabularyKnownIds,["会","做饭"]);assert.equal(saved.vocabularyChecked,true);assert.equal(saved.vocabularyTesting,true);assert.equal(saved.vocabularyIndex,5);
 assert.equal(parseFirstLesson({vocabularyIndex:Infinity}).vocabularyIndex,0);
});
test("a single unfamiliar core word joins two unfamiliar topic words in one batch",()=>{
 const input=words.slice(0,5),groups=[{id:"core",title:"Core",wordIds:input.slice(0,3).map(w=>w.id)},{id:"personalized",title:"Topic",wordIds:input.slice(3).map(w=>w.id)}];
 const active=groupedVocabularyBatch(input,groups,["word-0","word-1"],0)!;
 assert.deepEqual(active.batch.map(w=>w.id),["word-2","word-3","word-4"]);
 assert.equal(active.rounds,1);assert.deepEqual(active.quizPairs,active.batch);
});
test("leftover new words use previously taught words, or familiar words in the first batch",()=>{
 const groups=[{id:"all",title:"All",wordIds:words.map(w=>w.id)}];
 for(const size of [4,5,7,8]){
  const input=words.slice(0,size),start=Math.floor((size-1)/3)*3;
  const active=groupedVocabularyBatch(input,groups,[],size-1)!;
  assert.equal(active.quizPairs.length,3);
  assert.deepEqual(active.quizPairs.slice(active.batch.length),input.slice(0,start).reverse().slice(0,3-active.batch.length));
 }
 const active=groupedVocabularyBatch(words,groups,words.slice(1).map(w=>w.id),0)!;
 assert.equal(active.batch.length,1);assert.equal(active.quizPairs.length,3);
 assert.deepEqual(active.quizPairs.map(w=>w.id),["word-0","word-1","word-2"]);
 assert.equal(groupedVocabularyBatch(words,groups,words.map(w=>w.id),0),null);
});
test("ordering is complete and unique even when categories overlap or omit words",()=>{
 assert.deepEqual(orderedVocabulary(words,[{wordIds:["word-1","word-1","missing"]}]).map(w=>w.id),["word-1",...words.filter(w=>w.id!=="word-1").map(w=>w.id)]);
});
test("every familiarity combination across all 72 courses teaches and tests every new word without single-option quizzes",()=>{
 for(const goal of GOALS)for(const tier of [1,2,3,4,5,6] as CourseTier[])for(const variant of [0,1]){
  const lesson=makeBudgetCourse(tier,goal.key,variant),groups=lesson.curriculum!.vocabularyGroups;
  const ordered=orderedVocabulary(lesson.match,groups);
  for(let mask=0;mask<2**ordered.length;mask++){
   const known=ordered.filter((_,i)=>mask&(1<<i)).map(w=>w.id),unknown=unfamiliarVocabulary(ordered,known);
   const taught:string[]=[],tested=new Set<string>();
   for(let index=0;index<unknown.length;){
    const active=groupedVocabularyBatch(ordered,groups,known,index)!;
    assert.ok(active.batch.length>=1&&active.batch.length<=3);
    if(index+3<unknown.length)assert.equal(active.batch.length,3);
    assert.equal(active.quizPairs.length,3,lesson.id);
    assert.equal(new Set(active.quizPairs.map(w=>w.id)).size,3);
    const available=new Set([...known,...taught,...active.batch.map(w=>w.id)]);
    for(const word of active.quizPairs){assert.ok(available.has(word.id));tested.add(word.id);}
    for(const word of active.batch)assert.ok(active.quizPairs.some(w=>w.id===word.id));
    for(let i=active.batchStart;i<active.batchStart+active.batch.length;i++)assert.deepEqual(groupedVocabularyBatch(ordered,groups,known,i),active);
    taught.push(...active.batch.map(w=>w.id));index=active.batchStart+active.batch.length;
   }
   assert.deepEqual(taught,unknown.map(w=>w.id));
   for(const word of unknown)assert.ok(tested.has(word.id));
  }
 }
});
