import {test} from "node:test";
import assert from "node:assert/strict";
import {unfamiliarVocabulary,vocabularyBatch,groupedVocabularyBatch} from "../../lib/onboarding/personalized/firstLesson/vocabulary";
import {parseFirstLesson} from "../../lib/onboarding/personalized/flow";
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
 assert.equal(unfamiliarVocabulary(words,words.map(w=>w.id)).length,0);
});
test("familiarity selection and the pending batch test survive normalized progress",()=>{
 const saved=parseFirstLesson({version:2,phase:"vocabulary",vocabularyKnownIds:["会","会",null,42,"做饭"],vocabularyChecked:true,vocabularyTesting:true,vocabularyIndex:5});
 assert.deepEqual(saved.vocabularyKnownIds,["会","做饭"]);assert.equal(saved.phase,"vocabulary");assert.equal(saved.vocabularyChecked,true);assert.equal(saved.vocabularyTesting,true);assert.equal(saved.vocabularyIndex,5);
 const legacy=parseFirstLesson({});assert.equal(legacy.vocabularyKnownIds,undefined);assert.equal(legacy.vocabularyChecked,false);assert.equal(parseFirstLesson({vocabularyIndex:Infinity}).vocabularyIndex,0);
});

test("core and personalized words never share a teaching or matching batch",()=>{
 const groups=[{id:"core",title:"Core vocabulary",wordIds:words.slice(0,5).map(w=>w.id)},{id:"personalized",title:"Words for your goal",wordIds:words.slice(5).map(w=>w.id)}];
 for(const known of [[],["word-0","word-2","word-5"],words.slice(0,5).map(w=>w.id),words.slice(5).map(w=>w.id)]){
  let i=0;const taught:string[]=[];
  while(i<unfamiliarVocabulary(words,known).length){
   const active=groupedVocabularyBatch(words,groups,known,i)!;assert.ok(active);assert.ok(active.batch.length<=3);
   assert.ok(active.batch.every(w=>active.group.wordIds.includes(w.id)));taught.push(...active.batch.map(w=>w.id));i=active.batchStart+active.batch.length;
  }
  assert.deepEqual(taught,unfamiliarVocabulary(words,known).map(w=>w.id));
 }
 assert.equal(groupedVocabularyBatch(words,groups,words.slice(0,5).map(w=>w.id),0)!.group.id,"personalized");
 assert.equal(groupedVocabularyBatch(words,groups,words.map(w=>w.id),0),null);
});
