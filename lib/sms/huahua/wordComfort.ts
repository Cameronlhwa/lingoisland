// Texting comfort model. This is separate from quiz mastery, streaks, and
// island progress: it never writes to those tables and never adds words to
// quizzes. Scores run 0–1; new words start at 0.3.

export type ComfortSignal =
  | "understood"
  | "used_successfully"
  | "requested_pinyin"
  | "requested_translation"
  | "requested_easier"
  | "error"
  | "ignored";

export const COMFORT_SIGNALS: readonly ComfortSignal[] = [
  "understood",
  "used_successfully",
  "requested_pinyin",
  "requested_translation",
  "requested_easier",
  "error",
  "ignored",
];

const DELTAS: Record<ComfortSignal, number> = {
  understood: 0.08,
  used_successfully: 0.12,
  requested_pinyin: -0.04,
  requested_translation: -0.06,
  requested_easier: -0.08,
  error: -0.1,
  ignored: -0.02,
};

export const NEEDS_PRACTICE_BELOW = 0.45;
export const COMFORTABLE_FROM = 0.7;

export type Vocab = { hanzi: string; pinyin?: string | null; english?: string | null };

export type WordSignal = {
  word: string;
  pinyin?: string | null;
  english?: string | null;
  signal: ComfortSignal;
  delta: number;
  source?: "journey" | "conversation";
  journey_island_id?: string | null;
};

export function isComfortSignal(value: unknown): value is ComfortSignal {
  return COMFORT_SIGNALS.includes(value as ComfortSignal);
}

export function signalDelta(signal: ComfortSignal) {
  return DELTAS[signal];
}

export function applyDelta(score: number, signal: ComfortSignal) {
  return Math.min(1, Math.max(0, score + DELTAS[signal]));
}

export function comfortBand(score: number) {
  if (score >= COMFORTABLE_FROM) return "comfortable" as const;
  if (score < NEEDS_PRACTICE_BELOW) return "needs_practice" as const;
  return "learning" as const;
}

/**
 * Builds signals for the words in play. Model-reported updates are only
 * accepted for words that were actually targeted or appear in the
 * learner's text, so the model can't invent progress.
 */
export function buildWordSignals(input: {
  targetVocab: Vocab[];
  learnerText: string;
  modelUpdates?: Array<{ word: string; signal: ComfortSignal }>;
  commandSignal?: ComfortSignal | null;
  source?: "journey" | "conversation";
  journeyIslandId?: string | null;
}): WordSignal[] {
  const byWord = new Map(input.targetVocab.map((vocab) => [vocab.hanzi, vocab]));
  const signals = new Map<string, WordSignal>();
  const add = (word: string, signal: ComfortSignal) => {
    const vocab = byWord.get(word);
    if (!vocab && !input.learnerText.includes(word)) return;
    signals.set(`${word}:${signal}`, {
      word,
      pinyin: vocab?.pinyin ?? null,
      english: vocab?.english ?? null,
      signal,
      delta: signalDelta(signal),
      source: input.source ?? "conversation",
      journey_island_id: input.journeyIslandId ?? null,
    });
  };

  if (input.commandSignal) {
    for (const vocab of input.targetVocab) add(vocab.hanzi, input.commandSignal);
  } else if (input.modelUpdates && input.modelUpdates.length > 0) {
    for (const update of input.modelUpdates) add(update.word, update.signal);
  } else {
    for (const vocab of input.targetVocab) {
      if (vocab.hanzi && input.learnerText.includes(vocab.hanzi)) add(vocab.hanzi, "used_successfully");
    }
  }
  return Array.from(signals.values()).slice(0, 20);
}
