export const CHECKLIST_WORDS_PER_LEVEL = 8;
export const CHECKLIST_DECOY_COUNT = 9;
export const CHECKLIST_PASS_RATE = 0.6;

export type ChecklistWord = {
  id: string;
  hanzi: string;
  level: number;
};

export type ChecklistDecoy = {
  id: string;
  hanzi: string;
};

export type ChecklistItem =
  | { kind: "word"; id: string; hanzi: string; level: number }
  | { kind: "decoy"; id: string; hanzi: string };

export function scoreChecklist({
  words,
  knownWordIds,
  knownDecoyIds,
  decoyCount = CHECKLIST_DECOY_COUNT,
}: {
  words: ChecklistWord[];
  knownWordIds: string[];
  knownDecoyIds: string[];
  decoyCount?: number;
}): { estimatedLevel: number; falsePositiveRate: number; rates: Record<number, number> } {
  const known = new Set(knownWordIds);
  const denom = Math.max(1, decoyCount);
  const falsePositiveRate = Math.min(1, knownDecoyIds.length / denom);

  const rates: Record<number, number> = {};
  let estimatedLevel = 1;

  for (let level = 1; level <= 6; level++) {
    const atLevel = words.filter((w) => w.level === level);
    const sampleSize = Math.max(1, atLevel.length);
    const knownCount = atLevel.filter((w) => known.has(w.id)).length;
    const corrected = Math.max(0, knownCount / sampleSize - falsePositiveRate);
    rates[level] = corrected;
    if (corrected >= CHECKLIST_PASS_RATE) {
      estimatedLevel = level;
    } else {
      break;
    }
  }

  return { estimatedLevel, falsePositiveRate, rates };
}

export function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
