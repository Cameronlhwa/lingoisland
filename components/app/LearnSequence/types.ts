export interface LearnSentence {
  id: string;
  tier: "easy" | "same" | "hard";
  hanzi: string;
  pinyin: string;
  english: string;
}

export interface LearnWord {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string;
  position?: number;
  /** Set for words drawn from an official HSK band (curriculum units). */
  hsk_level?: number | null;
  sentences: LearnSentence[];
}

export interface LearnIsland {
  id: string;
  topic: string;
  level: string;
}

export type LearnStep = "slideshow" | "dragdrop" | "chat";

export const learnSequenceKey = (islandId: string) =>
  `island_learn_done_${islandId}`;

export function pickLearnWords(words: LearnWord[], count = 5): LearnWord[] {
  const sorted = [...words].sort(
    (a, b) => (a.position ?? 999) - (b.position ?? 999),
  );
  return sorted.slice(0, count);
}

export function pickExampleSentence(word: LearnWord): LearnSentence | null {
  const easy = word.sentences.find((s) => s.tier === "easy");
  if (easy) return easy;
  if (word.sentences[1]) return word.sentences[1];
  return word.sentences[0] ?? null;
}
