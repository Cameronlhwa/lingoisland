import type { SpeechSuperResult } from "@/lib/speechsuper/client";

export type PhonemeScore = {
  role: "initial" | "final" | "other";
  phone: string;
  pronunciation: number | null;
};

export type CharacterScore = {
  hanzi: string;
  pinyin: string | null;
  targetTone: number | null;
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

function extractCharacters(value: SpeechSuperResult | null): CharacterScore[] {
  const words = speechResult(value)?.words;
  if (!Array.isArray(words)) return [];
  return words.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const word = item as Record<string, unknown>;
    const hanzi = typeof word.word === "string" ? word.word : "";
    const scores = word.scores as Record<string, unknown> | undefined;
    if (!hanzi) return [];
    return [
      {
        hanzi,
        pinyin:
          typeof word.symbolpinyin === "string"
            ? word.symbolpinyin
            : typeof word.pinyin === "string"
              ? word.pinyin
              : null,
        targetTone: toneNumber(word.tone),
        score: asNumber(scores?.tone ?? scores?.overall ?? scores?.pronunciation),
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
export function normalizeSpeechSuperResult(raw: SpeechSuperResult): NormalizedScore {
  const metrics = speechResult(raw);
  return {
    overall: asNumber(metrics?.overall),
    pronunciation: asNumber(metrics?.pronunciation),
    tone: asNumber(metrics?.tone),
    fluency: asNumber(metrics?.fluency),
    rhythm: asNumber(metrics?.rhythm),
    characters: extractCharacters(raw),
  };
}
