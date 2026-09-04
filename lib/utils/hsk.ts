export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export type HskStandard = "2.0" | "3.0";

export const DEFAULT_HSK_STANDARD: HskStandard = "3.0";

export function parseHskStandard(value: unknown): HskStandard {
  return value === "2.0" ? "2.0" : "3.0";
}

/** Internal level id for the official HSK 7-9 band (stored as 7 in the DB). */
export const HSK_MAX_LEVEL = 7;

export const HSK_LEVEL_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

export function hskMaxStoredLevel(standard: HskStandard = DEFAULT_HSK_STANDARD): number {
  return standard === "2.0" ? 6 : HSK_MAX_LEVEL;
}

export function hskLevelOptions(standard: HskStandard = DEFAULT_HSK_STANDARD): {
  level: number;
  label: string;
}[] {
  const max = hskMaxStoredLevel(standard);
  return Array.from({ length: max }, (_, i) => {
    const level = i + 1;
    return { level, label: formatHskLevel(level) };
  });
}

/** User-facing label, e.g. "HSK 4" or "HSK 7-9". */
export function formatHskLevel(level: number): string {
  if (level === 7) return "HSK 7-9";
  return `HSK ${level}`;
}

export function nextHskTargetLevel(currentLevel: number): number {
  return Math.min(HSK_MAX_LEVEL, currentLevel + 1);
}

/**
 * Real seeded word counts per HSK level (data/hsk-vocabulary-3.0.json, verified
 * against scripts/import_hsk_vocabulary.py's expected-count check). Level 7 is
 * the HSK 7-9 band. Used only for the plan-reveal's "words you roughly know" /
 * "words needed for your goal" estimate — not a precise mastery measurement.
 */
const HSK_LEVEL_WORD_COUNTS: Record<number, number> = {
  1: 300,
  2: 200,
  3: 500,
  4: 1000,
  5: 1600,
  6: 1800,
  7: 5600,
};

/** Cumulative real HSK word count from level 1 through `level`, inclusive. */
export function cumulativeHskWordCount(level: number): number {
  let sum = 0;
  for (let l = 1; l <= level; l++) sum += HSK_LEVEL_WORD_COUNTS[l] ?? 0;
  return sum;
}
