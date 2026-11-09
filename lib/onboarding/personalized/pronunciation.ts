// Optional two-word pronunciation check. Results only adjust tone and pinyin
// support; no score is ever shown or stored.

import type { TopicFamily } from "./goals";
import { clampLevel } from "./levels";

export type PronunciationWord = { hanzi: string; pinyin: string; english: string };

export type PronunciationStatus = "not_started" | "skipped" | "denied" | "failed" | "completed";
export type ToneSupport = "standard" | "extra";

const INTEREST_WORDS: Record<TopicFamily, PronunciationWord[]> = {
  work: [
    { hanzi: "工作", pinyin: "gōngzuò", english: "work" },
    { hanzi: "开会", pinyin: "kāihuì", english: "have a meeting" },
  ],
  school: [
    { hanzi: "学习", pinyin: "xuéxí", english: "study" },
    { hanzi: "老师", pinyin: "lǎoshī", english: "teacher" },
  ],
  family: [
    { hanzi: "妈妈", pinyin: "māma", english: "mom" },
    { hanzi: "家人", pinyin: "jiārén", english: "family" },
  ],
  travel: [
    { hanzi: "谢谢", pinyin: "xièxie", english: "thank you" },
    { hanzi: "米饭", pinyin: "mǐfàn", english: "rice" },
  ],
  everyday: [
    { hanzi: "朋友", pinyin: "péngyou", english: "friend" },
    { hanzi: "吃饭", pinyin: "chīfàn", english: "eat a meal" },
  ],
};

/** One representative word per level (0 = pre-HSK). */
const LEVEL_WORDS: PronunciationWord[] = [
  { hanzi: "你好", pinyin: "nǐ hǎo", english: "hello" },
  { hanzi: "喝水", pinyin: "hē shuǐ", english: "drink water" },
  { hanzi: "喜欢", pinyin: "xǐhuan", english: "like" },
  { hanzi: "应该", pinyin: "yīnggāi", english: "should" },
  { hanzi: "经验", pinyin: "jīngyàn", english: "experience" },
  { hanzi: "积极", pinyin: "jījí", english: "positive, proactive" },
  { hanzi: "斟酌", pinyin: "zhēnzhuó", english: "to deliberate" },
];

/** Only these words may be scored by the onboarding check. */
export function isPronunciationWord(hanzi: unknown): hanzi is string {
  if (typeof hanzi !== "string") return false;
  if (LEVEL_WORDS.some((word) => word.hanzi === hanzi)) return true;
  return Object.keys(INTEREST_WORDS).some((family) => INTEREST_WORDS[family as TopicFamily].some((word) => word.hanzi === hanzi));
}

/** First an easier word tied to an interest, then one near the provisional level. */
export function pronunciationWords(family: TopicFamily, level: number): [PronunciationWord, PronunciationWord] {
  const representative = LEVEL_WORDS[clampLevel(level)];
  const pool = INTEREST_WORDS[family] ?? INTEREST_WORDS.everyday;
  const easier = pool.find((word) => word.hanzi !== representative.hanzi) ?? INTEREST_WORDS.everyday[0];
  return [easier, representative];
}

export type PronunciationResult = { word: string; needsToneSupport: boolean };

/** Extra tone and pinyin support when any attempt struggled with tones. */
export function toneSupportFrom(results: readonly PronunciationResult[]): ToneSupport | null {
  if (results.length === 0) return null;
  return results.some((result) => result.needsToneSupport) ? "extra" : "standard";
}

/** Server-side: SpeechSuper scores (0 to 100) to a support flag. Never exposed as a number. */
export function needsToneSupport(scores: { overall: number | null; tone: number | null }) {
  const values = [scores.overall, scores.tone].filter((value): value is number => typeof value === "number");
  if (values.length === 0) return false;
  return values.some((value) => value < 60);
}
