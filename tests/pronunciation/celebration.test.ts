import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isCelebrationEligible, claimCelebration, markFreshScore, celebrationSoundEnabled,
  setCelebrationSoundEnabled, prepareCelebrationSound, playCelebrationSound, stopCelebrationSound,
} from "../../lib/pronunciation/celebration";

test("celebrates only a fresh, valid pronunciation score of at least 90", () => {
  for (const overallScore of [90, 94, 100]) assert.equal(isCelebrationEligible({attemptId:"boundary",overallScore,newlyScored:true}),true);
  for (const overallScore of [null, 0, 89, 89.99, NaN, Infinity, 101]) assert.equal(isCelebrationEligible({attemptId:"boundary",overallScore,newlyScored:true}),false);
  assert.equal(isCelebrationEligible({attemptId:"",overallScore:95,newlyScored:true}),false);
  assert.equal(isCelebrationEligible({attemptId:"saved",overallScore:95}),false);
  assert.equal(isCelebrationEligible({attemptId:"saved",overallScore:95,newlyScored:false}),false);
});

test("freshness is never serialized into saved session checkpoints", () => {
  const result=markFreshScore({attemptId:"checkpoint-result",overallScore:94});
  assert.equal(isCelebrationEligible(result),true);
  const checkpoint=JSON.parse(JSON.stringify({wordResult:result}));
  assert.equal(checkpoint.wordResult.newlyScored,undefined);
  assert.equal(isCelebrationEligible(checkpoint.wordResult),false);
});

test("a retry response or remount never celebrates the same attempt twice", () => {
  const result={attemptId:"deduplicate-this-attempt",overallScore:94,newlyScored:true};
  assert.equal(claimCelebration(result),true);
  assert.equal(claimCelebration({...result}),false);
  assert.equal(claimCelebration({...result,attemptId:"a-new-recording"}),true);
});

test("restored or low results do not consume a future eligible celebration", () => {
  assert.equal(claimCelebration({attemptId:"fresh-after-restore",overallScore:94}),false);
  assert.equal(claimCelebration({attemptId:"fresh-after-restore",overallScore:94,newlyScored:true}),true);
  assert.equal(claimCelebration({attemptId:"fresh-after-low",overallScore:80,newlyScored:true}),false);
  assert.equal(claimCelebration({attemptId:"fresh-after-low",overallScore:90,newlyScored:true}),true);
});

test("audio unlocks on preparation, respects mute, and cancels late playback", async () => {
  const previousWindow=globalThis.window;
  const previousDocument=globalThis.document;
  const previousFetch=globalThis.fetch;
  const preferences=new Map<string,string>();
  let starts=0,resumes=0,stops=0,fetches=0;
  let releaseFetch!: (value:Response)=>void;
  class FakeContext {
    state="suspended";
    destination={};
    resume(){resumes++;this.state="running";return Promise.resolve();}
    decodeAudioData(){return Promise.resolve({duration:1.62});}
    createGain(){return {gain:{value:0},connect(){},disconnect(){}};}
    createBufferSource(){return {buffer:null,onended:null,connect(){},disconnect(){},start(){starts++;},stop(){stops++;}};}
  }
  Object.defineProperty(globalThis,"window",{configurable:true,writable:true,value:{AudioContext:FakeContext,localStorage:{getItem:(key:string)=>preferences.get(key)??null,setItem:(key:string,value:string)=>preferences.set(key,value)}}});
  Object.defineProperty(globalThis,"document",{configurable:true,writable:true,value:{hidden:false}});
  globalThis.fetch=(()=>{fetches++;return new Promise<Response>(resolve=>{releaseFetch=resolve;});}) as typeof fetch;
  try {
    assert.equal(celebrationSoundEnabled(),true);
    prepareCelebrationSound();
    assert.equal(resumes,1);
    assert.equal(fetches,1);
    const delayed=playCelebrationSound();
    stopCelebrationSound();
    releaseFetch(new Response(new ArrayBuffer(8)));
    await delayed;
    assert.equal(starts,0,"a cancelled request must not play when decoding finishes");
    await playCelebrationSound();
    assert.equal(starts,1);
    assert.equal(fetches,1,"reuse the decoded sound");
    setCelebrationSoundEnabled(false);
    assert.equal(celebrationSoundEnabled(),false);
    assert.equal(stops,1);
    await playCelebrationSound();
    assert.equal(starts,1);
    setCelebrationSoundEnabled(true);
    await playCelebrationSound();
    assert.equal(starts,2);
    stopCelebrationSound();
  } finally {
    globalThis.fetch=previousFetch;
    Object.defineProperty(globalThis,"window",{configurable:true,writable:true,value:previousWindow});
    Object.defineProperty(globalThis,"document",{configurable:true,writable:true,value:previousDocument});
  }
});

test("unavailable browser storage cannot break scoring or the sound toggle", () => {
  const previousWindow=globalThis.window;
  Object.defineProperty(globalThis,"window",{configurable:true,writable:true,value:{localStorage:{getItem(){throw new Error("Blocked");},setItem(){throw new Error("Blocked");}}}});
  try { assert.equal(celebrationSoundEnabled(),true); assert.doesNotThrow(()=>setCelebrationSoundEnabled(false)); }
  finally { Object.defineProperty(globalThis,"window",{configurable:true,writable:true,value:previousWindow}); }
});
