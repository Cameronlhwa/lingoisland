import type { SpeechSuperResult } from "@/lib/speechsuper/client";
import { spokenTonesForText, type CharacterTones } from "@/lib/pronunciation/surfacePinyin";

export type PhonemeScore = {
  role: "initial" | "final" | "other";
  phone: string;
  pronunciation: number | null;
};

export type CharacterScore = {
  hanzi: string;
  /** Spoken/surface pinyin for this context (sandhi-aware when applicable). */
  pinyin: string | null;
  /** Dictionary/citation pinyin — identity for weak-sound tracking. Isolate drills use spoken form when sandhiApplied. */
  citationPinyin: string | null;
  /** Expected spoken tone in this sentence (prefers tone_sandhi). */
  targetTone: number | null;
  /** Dictionary/citation tone — identity for weak-sound tracking. Isolate drills use spoken form when sandhiApplied. */
  citationTone: number | null;
  sandhiApplied: boolean;
  score: number | null;
  phonemes: PhonemeScore[];
};

export type NormalizedScore = {
  overall: number | null;
  pronunciation: number | null;
  tone: number | null;
  fluency: number | null;
  rhythm: number | null;
  characters: CharacterScore[];
};

const TONE_MARKS: Record<string, string[]> = {
  a: ["ā", "á", "ǎ", "à", "a"],
  e: ["ē", "é", "ě", "è", "e"],
  i: ["ī", "í", "ǐ", "ì", "i"],
  o: ["ō", "ó", "ǒ", "ò", "o"],
  u: ["ū", "ú", "ǔ", "ù", "u"],
  v: ["ǖ", "ǘ", "ǚ", "ǜ", "ü"],
};

function asNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function speechResult(value: SpeechSuperResult | null): Record<string, unknown> | null {
  const nested = value?.result;
  return nested && typeof nested === "object" ? (nested as Record<string, unknown>) : null;
}

function toneNumber(value: unknown): number | null {
  const match = typeof value === "string" ? value.match(/tone([1-4])/i) : null;
  return match ? Number(match[1]) : null;
}

/** Apply a 1–4 tone mark to a bare pinyin syllable (e.g. "hen" + 2 → "hén"). */
function applyToneMark(syllable: string, tone: number): string {
  const s = syllable.toLowerCase().replace(/ü/g, "v");
  if (tone < 1 || tone > 5) return syllable.toLowerCase().replace(/v/g, "ü");
  const mark = (vowel: string) => TONE_MARKS[vowel][tone - 1];

  if (s.includes("a")) return s.replace("a", mark("a")).replace(/v/g, "ü");
  if (s.includes("e")) return s.replace("e", mark("e")).replace(/v/g, "ü");
  if (s.includes("ou")) return s.replace("o", mark("o")).replace(/v/g, "ü");
  if (s.includes("v")) return s.replace("v", mark("v"));
  for (const vowel of ["u", "i", "o"] as const) {
    const idx = s.lastIndexOf(vowel);
    if (idx >= 0) {
      return (s.slice(0, idx) + mark(vowel) + s.slice(idx + 1)).replace(/v/g, "ü");
    }
  }
  return s.replace(/v/g, "ü");
}

function barePinyin(word: Record<string, unknown>): string | null {
  const raw = typeof word.rawpinyin === "string" ? word.rawpinyin : null;
  if (raw) {
    const match = raw.match(/^([a-züÜv:]+)[1-5]?$/i);
    if (match) return match[1].toLowerCase();
  }
  if (typeof word.pinyin === "string" && word.pinyin.trim()) {
    return word.pinyin.trim().toLowerCase().replace(/[1-5]/g, "");
  }
  return null;
}

function citationPinyinFrom(word: Record<string, unknown>): string | null {
  if (typeof word.symbolpinyin === "string" && word.symbolpinyin.trim()) {
    return word.symbolpinyin.trim();
  }
  const bare = barePinyin(word);
  const citation = toneNumber(word.tone);
  if (bare && citation) return applyToneMark(bare, citation);
  if (bare) return bare;
  return typeof word.pinyin === "string" ? word.pinyin : null;
}

function spokenPinyinFrom(
  word: Record<string, unknown>,
  spokenTone: number | null,
  citationPinyin: string | null,
  sandhiApplied: boolean,
): string | null {
  if (sandhiApplied && spokenTone) {
    const bare = barePinyin(word);
    if (bare) return applyToneMark(bare, spokenTone);
  }
  return citationPinyin;
}

function firstNormalizedSyllable(word: Record<string, unknown>): Record<string, unknown> | null {
  const syllables = word.normalized_syllables;
  if (!Array.isArray(syllables) || syllables.length === 0) return null;
  const first = syllables[0];
  return first && typeof first === "object" ? (first as Record<string, unknown>) : null;
}

function extractPhonemes(word: Record<string, unknown>): PhonemeScore[] {
  const phonemes = word.phonemes;
  if (!Array.isArray(phonemes)) return [];
  return phonemes.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const phoneme = item as Record<string, unknown>;
    const category = asNumber(phoneme.category);
    const role = category === 0 ? "initial" : category === 1 ? "final" : "other";
    const phone = typeof phoneme.phone === "string" ? phoneme.phone : "";
    if (!phone) return [];
    return [{ role, phone, pronunciation: asNumber(phoneme.pronunciation) } as PhonemeScore];
  });
}

/**
 * When sandhi applies, SpeechSuper may still score `scores.tone` against the
 * citation tone. Prefer overall/pronunciation so correct surface tones aren't
 * marked weak.
 */
function characterScoreValue(
  scores: Record<string, unknown> | undefined,
  sandhiApplied: boolean,
): number | null {
  const tone = asNumber(scores?.tone);
  const overall = asNumber(scores?.overall ?? scores?.overall_pron ?? scores?.pronunciation);
  if (sandhiApplied) return overall ?? tone;
  return tone ?? overall;
}

/**
 * Walks the reference text alongside SpeechSuper's words so each scored
 * character can be matched with its spoken tone from our sandhi rules.
 */
function toneCursor(tones: CharacterTones[]) {
  let position = 0;
  return (hanzi: string): CharacterTones | null => {
    for (let index = position; index < tones.length; index += 1) {
      if (tones[index].hanzi === hanzi) {
        position = index + 1;
        return tones[index];
      }
    }
    return null;
  };
}

function extractCharacters(value: SpeechSuperResult | null, referenceText?: string): CharacterScore[] {
  const words = speechResult(value)?.words;
  if (!Array.isArray(words)) return [];
  const hanziOf = (item: unknown) =>
    item && typeof item === "object" && typeof (item as Record<string, unknown>).word === "string"
      ? ((item as Record<string, unknown>).word as string)
      : "";
  const nextTones = toneCursor(spokenTonesForText(referenceText?.trim() || words.map(hanziOf).join("")));
  return words.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const word = item as Record<string, unknown>;
    const hanzi = typeof word.word === "string" ? word.word : "";
    const scores = word.scores as Record<string, unknown> | undefined;
    if (!hanzi) return [];

    const syllable = firstNormalizedSyllable(word);
    const citationTone = toneNumber(syllable?.tone ?? word.tone);
    const reported = toneNumber(syllable?.tone_sandhi);
    // SpeechSuper often omits tone_sandhi (for 不 before a 4th tone, for example).
    // Fill it in from the same rules the practice prompt uses, but only when we
    // agree on the dictionary tone, so a different reading is never overridden.
    const ours = nextTones(hanzi);
    const fromRules =
      ours && ours.spokenTone !== null && ours.citationTone === citationTone && ours.spokenTone !== citationTone
        ? ours.spokenTone
        : null;
    const spokenTone = reported ?? fromRules ?? citationTone;
    const sandhiApplied =
      spokenTone !== null && citationTone !== null && spokenTone !== citationTone;

    const citationPinyin = citationPinyinFrom(word);
    const pinyin = spokenPinyinFrom(word, spokenTone, citationPinyin, sandhiApplied);

    return [
      {
        hanzi,
        pinyin,
        citationPinyin,
        targetTone: spokenTone,
        citationTone,
        sandhiApplied,
        score: characterScoreValue(scores, sandhiApplied),
        phonemes: extractPhonemes(word),
      },
    ];
  });
}

/**
 * Reduces a raw SpeechSuper response down to the scores the UI actually
 * needs. Used both by the admin tone-test tool and the production
 * /api/pronunciation/score route so the raw SpeechSuper shape (and any
 * internal error codes it carries) never has to be re-parsed twice, and is
 * never forwarded to the client verbatim from the production route.
 */
export function normalizeSpeechSuperResult(raw: SpeechSuperResult, referenceText?: string): NormalizedScore {
  const metrics = speechResult(raw);
  return {
    overall: asNumber(metrics?.overall),
    pronunciation: asNumber(metrics?.pronunciation),
    tone: asNumber(metrics?.tone),
    fluency: asNumber(metrics?.fluency),
    rhythm: asNumber(metrics?.rhythm),
    characters: extractCharacters(raw, referenceText),
  };
}
