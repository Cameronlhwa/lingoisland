import type { CharacterScore } from "@/lib/pronunciation/normalizeScore";

const WEAK_SYLLABLE_THRESHOLD = 80;

export type IsolateTarget = {
  /** Weak character — kept as `syllable` so stored weak_syllables stay compatible. */
  syllable: string;
  hanzi: string;
  /** Spoken (sandhi) or citation pinyin of the weak syllable only — used for tone tips. */
  pinyin: string | null;
  targetTone: number | null;
  score: number | null;
  sandhiApplied: boolean;
  previousTone?: number | null;
  connectedSpeech?: boolean;
  citationPinyin: string | null;
  /** Phrase to say, hear, and score. Sandhi drills use the triggering pair (一个, 很好). */
  practiceText: string;
  practicePinyin: string | null;
};

export type StoredWeakSyllable = {
  syllable?: string;
  hanzi?: string;
  pinyin?: string | null;
  targetTone?: number | null;
  score?: number | null;
  sandhiApplied?: boolean;
  previousTone?: number | null;
  connectedSpeech?: boolean;
  citationPinyin?: string | null;
  practiceText?: string;
  practicePinyin?: string | null;
};

function isHanzi(value: string | undefined): value is string {
  return Boolean(value && /^[\u3400-\u9fff]$/.test(value));
}

export function coerceIsolateTarget(stored: StoredWeakSyllable): IsolateTarget {
  const hanzi = stored.hanzi ?? stored.syllable ?? "";
  return {
    syllable: hanzi,
    hanzi,
    pinyin: stored.pinyin ?? null,
    targetTone: stored.targetTone ?? null,
    score: stored.score ?? null,
    sandhiApplied: Boolean(stored.sandhiApplied),
    previousTone: stored.previousTone,
    connectedSpeech: stored.connectedSpeech,
    citationPinyin: stored.citationPinyin ?? null,
    practiceText: stored.practiceText ?? hanzi,
    practicePinyin: stored.practicePinyin ?? stored.pinyin ?? null,
  };
}

export function coerceIsolateTargets(value: unknown): IsolateTarget[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) =>
    coerceIsolateTarget(item && typeof item === "object" ? (item as StoredWeakSyllable) : {}),
  );
}

/**
 * When sandhi changed the spoken tone, isolate practice must use that spoken
 * form — not the dictionary citation — and a short pair so TTS/scoring hear
 * the sandhi context (一 in 一个 is yí, not yī).
 */
export function isolateTargetFromCharacter(
  characters: CharacterScore[],
  index: number,
): IsolateTarget {
  const character = characters[index];
  const next = characters[index + 1];
  const previous = characters[index - 1];
  const sandhi = Boolean(character.sandhiApplied);
  const pinyin = sandhi
    ? (character.pinyin ?? character.citationPinyin)
    : (character.citationPinyin ?? character.pinyin);
  const usePair = Boolean(sandhi && next && isHanzi(next.hanzi));
  const nextPinyin = usePair && next ? (next.pinyin ?? next.citationPinyin) : null;
  const usePrevious = character.targetTone === 5 && character.previousTone != null && previous && isHanzi(previous.hanzi);
  const practiceText = usePrevious ? `${previous.hanzi}${character.hanzi}` : usePair && next ? `${character.hanzi}${next.hanzi}` : character.hanzi;
  const practicePinyin = usePrevious ? [previous.pinyin ?? previous.citationPinyin, pinyin].filter(Boolean).join(" ") : usePair && nextPinyin ? [pinyin, nextPinyin].filter(Boolean).join(" ") : pinyin;

  return {
    syllable: character.hanzi,
    hanzi: character.hanzi,
    pinyin,
    targetTone: sandhi
      ? (character.targetTone ?? character.citationTone)
      : (character.citationTone ?? character.targetTone),
    score: character.score,
    sandhiApplied: sandhi,
    previousTone: character.previousTone,
    connectedSpeech: usePrevious || usePair,
    citationPinyin: character.citationPinyin,
    practiceText,
    practicePinyin,
  };
}

export function weakSyllablesFromCharacters(characters: CharacterScore[]): IsolateTarget[] {
  return characters
    .map((character, index) => ({ character, index }))
    .filter(({ character }) => character.score !== null && character.score < WEAK_SYLLABLE_THRESHOLD)
    .map(({ index }) => isolateTargetFromCharacter(characters, index));
}

export function isolateForForced(
  characters: CharacterScore[],
  forced: StoredWeakSyllable,
): IsolateTarget {
  const hanzi = forced.hanzi ?? forced.syllable ?? "";
  const sandhiIdx = characters.findIndex((character) => character.hanzi === hanzi && character.sandhiApplied);
  const idx = sandhiIdx >= 0 ? sandhiIdx : characters.findIndex((character) => character.hanzi === hanzi);
  if (idx >= 0) return isolateTargetFromCharacter(characters, idx);
  return coerceIsolateTarget(forced);
}

export function pickIsolateFocus(
  characters: CharacterScore[],
  storedWeak?: StoredWeakSyllable[] | null,
  forced?: StoredWeakSyllable | null,
): IsolateTarget | null {
  const fromChars = weakSyllablesFromCharacters(characters);
  if (fromChars[0]) return fromChars[0];
  if (forced?.hanzi || forced?.syllable) return isolateForForced(characters, forced);
  if (storedWeak?.[0]) {
    const hanzi = storedWeak[0].hanzi ?? storedWeak[0].syllable;
    const idx = hanzi ? characters.findIndex((character) => character.hanzi === hanzi) : -1;
    if (idx >= 0) return isolateTargetFromCharacter(characters, idx);
    return coerceIsolateTarget(storedWeak[0]);
  }
  return null;
}
