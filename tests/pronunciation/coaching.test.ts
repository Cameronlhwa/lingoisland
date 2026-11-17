import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contextualToneTarget, contextualToneTargetForSound, spokenTonesForText } from "../../lib/pronunciation/surfacePinyin";
import { normalizeSpeechSuperResult } from "../../lib/pronunciation/normalizeScore";
import { isolateTargetFromCharacter, coerceIsolateTarget } from "../../lib/pronunciation/isolateTarget";
import { toneShapeTip, toneName, toneGlyph } from "../../lib/pronunciation/encouragement";
import { guideForTone } from "../../lib/pronunciation/soundGuides";
import { parsePronunciationPieces } from "../../lib/onboarding/personalized/firstLesson/pronunciationResults";
import type { SpeechSuperResult } from "../../lib/speechsuper/client";

function score(text: string, tones: Array<number | null>, values: Array<number | null> = []) {
  const readings = spokenTonesForText(text);
  return normalizeSpeechSuperResult({ result: { overall: 92, words: Array.from(text).map((word, index) => ({
    word, rawpinyin: `${readings[index]?.spokenPinyin?.normalize("NFD").replace(/[\u0300-\u036f]/g, "") ?? "ma"}${tones[index] ?? ""}`,
    tone: tones[index] === null ? undefined : `tone${tones[index]}`,
    scores: { tone: values[index] ?? null },
  })) } } as unknown as SpeechSuperResult, text);
}

describe("shared tone coaching", () => {
  it("distinguishes low connected third tones from full isolated contours", () => {
    assert.match(toneShapeTip(3, {connectedSpeech: true})!, /Keep this tone low/);
    assert.match(toneShapeTip(3, {connectedSpeech: false})!, /on its own/);
    assert.equal(toneShapeTip(3), guideForTone(3)?.shortTip);
  });
  for (const [text, previous] of [["妈妈",1],["什么",2],["我们",3],["爸爸",4]] as const) {
    it(`retains neutral tone and its preceding tone in ${text}`, () => {
      const target = contextualToneTarget(text, 1)!;
      assert.equal(target.targetTone, 5);
      assert.equal(target.previousTone, previous);
      assert.equal(target.practiceText, text);
      assert.doesNotMatch(target.pinyin!, /[āáǎàēéěèīíǐìōóǒòūúǔù]/);
      assert.match(toneShapeTip(5, target)!, previous === 3 ? /higher/ : previous === 4 ? /staying low/ : /lower/);
    });
  }
  it("does not label unknown tone evidence as neutral", () => {
    assert.equal(toneShapeTip(null), null);
    assert.equal(toneName(5), "Neutral tone");
    assert.equal(toneGlyph(5), "·");
    assert.equal(spokenTonesForText("我，们")[1].spokenTone, null);
    assert.equal(contextualToneTarget("我，们",1),null);
  });
  for (const [text, expected] of [["水果",[2,3]],["不错",[2,4]],["一样",[2,4]],["一张",[4,1]],["一条",[4,2]],["一本",[4,3]],["一",[1]]] as const) {
    it(`keeps expected spoken tones for ${text}`, () => assert.deepEqual(spokenTonesForText(text).map(p => p.spokenTone), expected));
  }
});

describe("neutral scoring and contextual retries", () => {
  it("accepts the provider's tone0 spelling as neutral without a tone mark", () => {
    const neutral = score("我们", [3,0], [90,40]).characters[1];
    assert.equal(neutral.targetTone,5);
    assert.equal(neutral.citationTone,5);
    assert.equal(neutral.pinyin,"men");
  });
  it("coaches stored citation sounds in their example without converting old unknown records", () => {
    assert.equal(contextualToneTargetForSound("不是", "不", 4)?.targetTone, 2);
    assert.equal(contextualToneTargetForSound("我们", "们", null), null);
    assert.equal(contextualToneTargetForSound("我们", "们", 5)?.previousTone, 3);
  });
  it("normalizes provider neutral tone and keeps the preceding syllable in a retry", () => {
    const result = score("我们", [3,5], [90,40]);
    const neutral = result.characters[1];
    assert.equal(neutral.targetTone,5);
    assert.equal(neutral.previousTone,3);
    assert.equal(neutral.pinyin,"men");
    assert.equal(neutral.sandhiApplied,false);
    const target = isolateTargetFromCharacter(result.characters,1);
    assert.equal(target.practiceText,"我们");
    assert.equal(target.practicePinyin,"wǒ men");
    assert.equal(target.connectedSpeech,true);
  });
  it("keeps missing scores and missing tone evidence unassessed", () => {
    const result = score("妈",[null]);
    assert.equal(result.characters[0].score,null);
    assert.equal(result.characters[0].targetTone,null);
    assert.equal(result.tone,null);
    const old = coerceIsolateTarget({hanzi:"妈",targetTone:null,pinyin:null});
    assert.equal(old.targetTone,null);
  });
  it("preserves neutral and context in onboarding persistence", () => {
    const rows=[{hanzi:"们",pinyin:"men",score:45,targetTone:5,previousTone:3,connectedSpeech:true}];
    assert.deepEqual(parsePronunciationPieces(rows),rows);
    assert.equal(parsePronunciationPieces([{hanzi:"们",score:45,targetTone:null}])[0].targetTone,null);
  });
  it("keeps sandhi pairs and does not require a full rise in their connected third tone", () => {
    const result=score("你好",[3,3],[40,45]);
    const first=isolateTargetFromCharacter(result.characters,0);
    assert.equal(first.practiceText,"你好");
    assert.equal(first.pinyin,"ní");
    assert.equal(first.targetTone,2);
    assert.match(toneShapeTip(3,{connectedSpeech:true})!, /full rise is usually unnecessary/);
  });
});
