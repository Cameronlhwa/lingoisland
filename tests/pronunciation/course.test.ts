import assert from "node:assert/strict";
import {describe,it} from "node:test";
import {COURSE_UNITS,COURSE_ACTIVITIES,spokenPinyin} from "../../lib/pronunciation/course/content";
import {initialCourseProgress,reduceCourseProgress,courseSummary,safeCourseReturn} from "../../lib/pronunciation/course/progress";
import {withItemIds,resumeSession,sessionAverage,validCheckpoint} from "../../lib/pronunciation/sessionProgress";

describe("authored tone course",()=>{
  it("contains the complete five-unit curriculum with stable unique IDs",()=>{
    assert.deepEqual(COURSE_UNITS.map(unit=>unit.activities.length),[4,4,10,12,5]);
    assert.equal(new Set(COURSE_ACTIVITIES.map(activity=>activity.id)).size,35);
    assert.equal(COURSE_ACTIVITIES.filter(a=>a.kind==="rule").length,6);
    for(const activity of COURSE_ACTIVITIES){assert.ok(activity.text&&activity.meaning&&activity.explanation);if(activity.options)assert.ok(activity.answer!==undefined&&activity.options[activity.answer]);}
  });
  it("preserves first-answer accuracy, reveals after exactly two errors, and survives serialization",()=>{
    const activity=COURSE_ACTIVITIES.find(a=>a.kind==="listen")!;
    const wrong=(activity.answer!+1)%4;
    let p=reduceCourseProgress(initialCourseProgress(),{type:"answer",activityId:activity.id,selected:wrong});
    assert.equal(p.activities[activity.id].resolved,false);
    assert.throws(()=>reduceCourseProgress(p,{type:"complete",activityId:activity.id,skipSpeaking:true}),/Check your answer/);
    p=reduceCourseProgress(JSON.parse(JSON.stringify(p)),{type:"answer",activityId:activity.id,selected:wrong});
    assert.equal(p.activities[activity.id].errors,2);assert.equal(p.activities[activity.id].resolved,true);
    p=reduceCourseProgress(p,{type:"answer",activityId:activity.id,selected:activity.answer!});
    assert.equal(p.activities[activity.id].firstCorrect,false);assert.equal(p.activities[activity.id].errors,2);
  });
  it("does not confuse skipping a recording with pronunciation mastery",()=>{
    let p=initialCourseProgress();
    for(const activity of COURSE_ACTIVITIES){if(activity.options)p=reduceCourseProgress(p,{type:"answer",activityId:activity.id,selected:activity.answer!});p=reduceCourseProgress(p,{type:"complete",activityId:activity.id,skipSpeaking:true},"2026-11-13T03:00:00Z");}
    assert.equal(p.completedAt,null);
    assert.deepEqual(courseSummary(p),{completed:6,finished:35,total:35,speaking:0,skipped:29,firstCorrect:16,questionsAnswered:16,courseComplete:false});
    // Stale "course complete" stamps from older clients are cleared on load/save.
    const stale={...p,completedAt:"2026-11-13T03:00:00Z"};
    assert.equal(courseSummary(stale).courseComplete,false);
    assert.equal(reduceCourseProgress(stale,{type:"visit",activityId:"tone-1"}).completedAt,null);
    // Speaking every non-rule step is what unlocks course completion.
    for(const activity of COURSE_ACTIVITIES.filter(a=>a.kind!=="rule"))p=reduceCourseProgress(p,{type:"scored",activityId:activity.id,attemptId:`attempt-${activity.id}`},"2026-11-13T04:00:00Z");
    for(const activity of COURSE_ACTIVITIES)p=reduceCourseProgress(p,{type:"complete",activityId:activity.id},"2026-11-13T04:00:00Z");
    assert.equal(p.completedAt,"2026-11-13T04:00:00Z");
    assert.equal(courseSummary(p).courseComplete,true);
    assert.equal(courseSummary(p).speaking,29);
    const reset=reduceCourseProgress(p,{type:"reset"});
    assert.equal(reset.completedAt,null);
    assert.equal(Object.keys(reset.activities).length,0);
  });
  it("rejects invalid targets, choices and premature speaking results",()=>{
    assert.throws(()=>reduceCourseProgress(initialCourseProgress(),{type:"visit",activityId:"unknown"}));
    assert.throws(()=>reduceCourseProgress(initialCourseProgress(),{type:"answer",activityId:"listen-1",selected:4}));
    assert.throws(()=>reduceCourseProgress(initialCourseProgress(),{type:"scored",activityId:"listen-1",attemptId:"id"}));
    assert.throws(()=>reduceCourseProgress(initialCourseProgress(),{type:"complete",activityId:"tone-1"}),/speaking/);
  });
  it("keeps model pinyin spoken and return links inside authorized app routes",()=>{
    assert.match(spokenPinyin(COURSE_ACTIVITIES.find(a=>a.id==="rule-bu")!),/^Bú shì/);
    for(const unsafe of ["https://evil.test","//evil.test","/\\evil.test","/app/pronunciation/learn/tone-changes","/login"]){assert.equal(safeCourseReturn(unsafe),"/app/pronunciation/practice");}
    assert.equal(safeCourseReturn("/app/pronunciation/session/abc?journeyId=def"),"/app/pronunciation/session/abc?journeyId=def");
  });
  it("matches the listening models to their authored neutral-tone answers",()=>{
    const words=COURSE_UNITS.find(unit=>unit.id==="hear-and-say")!.activities;
    assert.deepEqual(words.filter(a=>a.spokenTones?.[1]===5).map(a=>[a.text,spokenPinyin(a)]),[
      ["朋友","Péng you"],["眼睛","Yǎn jing"],["故事","Gù shi"],["衣服","Yī fu"],
    ]);
    assert.deepEqual(COURSE_UNITS.find(unit=>unit.id==="tone-changes")!.activities.slice(0,6).map(a=>a.spokenTones),[[2,3],[2,4],[2,4],[4,1],[4,2],[4,3]]);
  });
});

describe("review session persistence",()=>{
  const item={wordHanzi:"你好",wordPinyin:"ní hǎo",wordEnglish:"Hello",sentenceHanzi:"你好。",sentencePinyin:"Ní hǎo.",sentenceEnglish:"Hello."};
  const items=withItemIds([item,item]);
  it("does not skip duplicated sentence text",()=>{
    const a={unit_type:"sentence",target_text:"你好。",overall_score:80};
    assert.equal(resumeSession(items,[a]).itemIndex,1);
    assert.equal(resumeSession(items,[{...a,item_id:"item-0"}]).itemIndex,1);
  });
  it("retains the exact focused-retry phase",()=>{
    const target={hanzi:"好",syllable:"好",pinyin:"hǎo",targetTone:3,score:40,sandhiApplied:false,citationPinyin:"hǎo",practiceText:"好",practicePinyin:"hǎo"};
    const p={itemId:"item-1",phase:"isolate-before" as const,wordResult:null,sentenceResult:null,isolateSyllable:target,isolateResult:null};
    assert.ok(validCheckpoint(p,items));assert.equal(resumeSession(items,[],p).phase,"isolate-before");assert.equal(resumeSession(items,[],p).itemIndex,1);
    assert.equal(validCheckpoint({...p,itemId:"unknown"},items),false);
  });
  it("summarizes the latest sentence result per item, excluding word and isolate retries",()=>{
    const base={target_text:"你好。",unit_type:"sentence"};
    assert.equal(sessionAverage([{...base,item_id:"item-0",overall_score:40},{...base,item_id:"item-0",overall_score:80},{...base,item_id:"item-1",overall_score:100},{...base,unit_type:"word",item_id:"item-0",overall_score:1}]),90);
  });
});
