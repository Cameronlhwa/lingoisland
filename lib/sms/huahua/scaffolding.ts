// Level scaffolding for HSK 1–6. Controls how much Chinese Huahua writes and
// how much pinyin/English support goes with it.

export type HskLevel = 1 | 2 | 3 | 4 | 5 | 6;
/** more = Chinese, pinyin, and English; on_request = help only when asked; less = mostly Chinese. */
export type ScaffoldingPreference = "auto" | "more" | "less" | "on_request";

export function isScaffoldingPreference(value: unknown): value is ScaffoldingPreference {
  return value === "auto" || value === "more" || value === "less" || value === "on_request";
}
export type LanguageMode = "balanced" | "english" | "chinese";

export type ScaffoldRule = {
  level: HskLevel;
  /** Rough cap on Chinese characters in one message. */
  maxChineseChars: number;
  pinyin: "always" | "new_words" | "on_request";
  translation: "always" | "hard_parts" | "on_request";
  guidance: string;
};

export const SCAFFOLD_RULES: Record<HskLevel, ScaffoldRule> = {
  1: {
    level: 1,
    maxChineseChars: 12,
    pinyin: "always",
    translation: "always",
    guidance:
      "HSK 1: one very short sentence using only HSK 1 words (你/我/好/是/吗/什么/喜欢…). Simple yes/no or either/or questions.",
  },
  2: {
    level: 2,
    maxChineseChars: 18,
    pinyin: "always",
    translation: "always",
    guidance: "HSK 2: one or two short sentences with HSK 1–2 words. Simple time, place, and preference questions.",
  },
  3: {
    level: 3,
    maxChineseChars: 26,
    pinyin: "new_words",
    translation: "hard_parts",
    guidance: "HSK 3: two short sentences, everyday topics, common measure words and 了/过. Gloss new words.",
  },
  4: {
    level: 4,
    maxChineseChars: 36,
    pinyin: "on_request",
    translation: "hard_parts",
    guidance: "HSK 4: natural everyday Mandarin, opinions and reasons (因为/所以/虽然). English only for uncommon words.",
  },
  5: {
    level: 5,
    maxChineseChars: 46,
    pinyin: "on_request",
    translation: "on_request",
    guidance: "HSK 5: natural, idiomatic Mandarin on work and current topics. Chinese only unless asked.",
  },
  6: {
    level: 6,
    maxChineseChars: 56,
    pinyin: "on_request",
    translation: "on_request",
    guidance: "HSK 6: fluent, nuanced Mandarin including chengyu where natural. Chinese only unless asked.",
  },
};

export function clampHsk(value: number): HskLevel {
  return Math.min(6, Math.max(1, Math.round(value))) as HskLevel;
}

/** Level used for this turn after session "easier"/"harder" commands. */
export function effectiveLevel(base: HskLevel, sessionOffset = 0): HskLevel {
  return clampHsk(base + sessionOffset);
}

const CEFR_TO_HSK: Record<string, HskLevel> = { A0: 1, A1: 2, A2: 3, B1: 4, B2: 5, C1: 6, C2: 6 };

/** Learner level from the profile (HSK field first, then CEFR band). Unknown = HSK 1. */
export function hskLevelFrom(input: {
  hskCurrentLevel?: unknown;
  cefrLevel?: string | null;
  contactLevel?: string | null;
}): HskLevel {
  const hsk = Number(input.hskCurrentLevel);
  if (Number.isFinite(hsk) && hsk >= 1) return clampHsk(hsk);
  for (const raw of [input.cefrLevel, input.contactLevel]) {
    const band = raw?.trim().toUpperCase().match(/^(A0|A1|A2|B1|B2|C1|C2)/)?.[1];
    if (band) return CEFR_TO_HSK[band];
  }
  return 1;
}

export type SessionSupport = {
  pinyin?: boolean;
  translation?: boolean;
  language?: LanguageMode;
};

export function supportFor(level: HskLevel, preference: ScaffoldingPreference, session: SessionSupport = {}) {
  const rule = SCAFFOLD_RULES[level];
  if (session.language === "chinese") {
    return { includePinyin: session.pinyin === true, includeTranslation: false };
  }
  let includePinyin = rule.pinyin === "always";
  let includeTranslation = rule.translation === "always";
  if (preference === "more") {
    includePinyin = level <= 4 || includePinyin;
    includeTranslation = true;
  } else if (preference === "on_request") {
    // Help arrives when the learner texts PINYIN or ENGLISH (session flags below).
    includePinyin = false;
    includeTranslation = false;
  } else if (preference === "less") {
    includePinyin = false;
    includeTranslation = false;
  }
  if (session.pinyin) includePinyin = true;
  if (session.translation || session.language === "english") includeTranslation = true;
  return { includePinyin, includeTranslation };
}
