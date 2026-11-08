import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeSpeechSuperResult } from "../../lib/pronunciation/normalizeScore";
import { spokenTonesForText, surfacePinyinForText } from "../../lib/pronunciation/surfacePinyin";
import type { SpeechSuperResult } from "../../lib/speechsuper/client";

type FakeWord = { word: string; bare: string; tone: number | 0; sandhi?: number; toneScore?: number; overall?: number };

/** SpeechSuper-shaped response. `sandhi` is omitted unless given, as SpeechSuper often does. */
function speechSuper(words: FakeWord[]): SpeechSuperResult {
  return {
    result: {
      overall: 88,
      words: words.map((w) => ({
        word: w.word,
        rawpinyin: `${w.bare}${w.tone || 5}`,
        tone: w.tone ? `tone${w.tone}` : "tone5",
        normalized_syllables: [{ tone: w.tone ? `tone${w.tone}` : "tone5", ...(w.sandhi ? { tone_sandhi: `tone${w.sandhi}` } : {}) }],
        scores: { tone: w.toneScore ?? 90, overall: w.overall ?? 90 },
        phonemes: [],
      })),
    },
  } as unknown as SpeechSuperResult;
}

const SENTENCE = "我不太喜欢别人问我学什么专业。";
const SENTENCE_WORDS: FakeWord[] = [
  { word: "我", bare: "wo", tone: 3 },
  { word: "不", bare: "bu", tone: 4, toneScore: 30, overall: 85 },
  { word: "太", bare: "tai", tone: 4 },
  { word: "喜", bare: "xi", tone: 3 },
  { word: "欢", bare: "huan", tone: 0 },
  { word: "别", bare: "bie", tone: 2 },
  { word: "人", bare: "ren", tone: 2 },
  { word: "问", bare: "wen", tone: 4 },
  { word: "我", bare: "wo", tone: 3 },
  { word: "学", bare: "xue", tone: 2 },
  { word: "什", bare: "shen", tone: 2 },
  { word: "么", bare: "me", tone: 0 },
  { word: "专", bare: "zhuan", tone: 1 },
  { word: "业", bare: "ye", tone: 4 },
];

describe("spoken tones", () => {
  it("applies 不, 一, and third-tone sandhi per character", () => {
    const tones = (text: string) => spokenTonesForText(text).map((t) => t.spokenTone);
    assert.deepEqual(tones("不太"), [2, 4]);
    assert.deepEqual(tones("一个"), [2, 4]);
    assert.deepEqual(tones("你好"), [2, 3]);
    assert.deepEqual(tones("你好，我很好"), [2, 3, null, 2, 2, 3], "punctuation breaks a third-tone run");
  });

  it("matches the practice prompt's sentence pinyin", () => {
    assert.match(surfacePinyinForText(SENTENCE), /^Wǒ bú tài/);
  });
});

describe("scored characters", () => {
  it("uses the spoken tone when SpeechSuper leaves out tone_sandhi", () => {
    const result = normalizeSpeechSuperResult(speechSuper(SENTENCE_WORDS), SENTENCE);
    const bu = result.characters[1];
    assert.equal(bu.hanzi, "不");
    assert.equal(bu.pinyin, "bú");
    assert.equal(bu.citationPinyin, "bù");
    assert.equal(bu.targetTone, 2);
    assert.equal(bu.citationTone, 4);
    assert.equal(bu.sandhiApplied, true);
    assert.equal(bu.score, 85, "not judged against the dictionary tone");
    assert.equal(result.characters[2].pinyin, "tài");
    assert.equal(result.characters[0].sandhiApplied, false, "我 before 不 stays third tone");
  });

  it("works without the reference text by reading the scored characters", () => {
    const result = normalizeSpeechSuperResult(speechSuper([
      { word: "你", bare: "ni", tone: 3 },
      { word: "好", bare: "hao", tone: 3 },
    ]));
    assert.deepEqual(result.characters.map((c) => c.pinyin), ["ní", "hǎo"]);
  });

  it("keeps SpeechSuper's own sandhi when it reports one", () => {
    const result = normalizeSpeechSuperResult(speechSuper([
      { word: "一", bare: "yi", tone: 1, sandhi: 4 },
      { word: "天", bare: "tian", tone: 1 },
    ]), "一天");
    assert.equal(result.characters[0].pinyin, "yì");
  });

  it("never overrides a reading SpeechSuper disagrees with", () => {
    const result = normalizeSpeechSuperResult(speechSuper([
      { word: "不", bare: "bu", tone: 1 },
      { word: "太", bare: "tai", tone: 4 },
    ]), "不太");
    assert.equal(result.characters[0].pinyin, "bū");
    assert.equal(result.characters[0].sandhiApplied, false);
  });
});
