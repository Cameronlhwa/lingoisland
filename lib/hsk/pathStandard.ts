import type { HskStandard } from "@/lib/utils/hsk";

/** Locked syllabus for My HSK Path (practice tests only exist for 2.0). */
export const HSK_PATH_STANDARD: HskStandard = "2.0";
export const HSK_PATH_MAX_LEVEL = 6;
export const HSK_PATH_LEVEL_OPTIONS = [1, 2, 3, 4, 5, 6] as const;

/** Sentinel stored on curriculum_units.interest_tag for Foundations units. */
export const FOUNDATIONS_INTEREST_TAG = "Foundations";

export const HSK_2_0_LEVEL_WORD_COUNTS: Record<number, number> = {
  1: 150,
  2: 150,
  3: 300,
  4: 600,
  5: 1300,
  6: 2500,
};

export function nextHskPathTargetLevel(currentLevel: number): number {
  return Math.min(HSK_PATH_MAX_LEVEL, Math.max(1, currentLevel) + 1);
}

export function cumulativeHsk20WordCount(level: number): number {
  let sum = 0;
  const capped = Math.min(HSK_PATH_MAX_LEVEL, Math.max(0, level));
  for (let l = 1; l <= capped; l++) sum += HSK_2_0_LEVEL_WORD_COUNTS[l] ?? 0;
  return sum;
}

export const HSK_LEVEL_SOURCES = ["official", "checklist"] as const;
export type HskLevelSource = (typeof HSK_LEVEL_SOURCES)[number];
