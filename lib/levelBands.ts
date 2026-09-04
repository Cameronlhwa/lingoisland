/**
 * User-facing levels are HSK 1–6. Content generation and `user_profiles.cefr_level`
 * still use CEFR bands (A0–C1). This module is the single mapping between them.
 *
 *   HSK 1 ↔ A0  (fixed intro course)
 *   HSK 2 ↔ A1
 *   HSK 3 ↔ A2
 *   HSK 4 ↔ B1
 *   HSK 5 ↔ B2
 *   HSK 6 ↔ C1
 */

import { formatHskLevel, HSK_MAX_LEVEL } from "@/lib/utils/hsk";

export const BASE_CEFR_LEVELS = ["A0", "A1", "A2", "B1", "B2", "C1"] as const;
export type CefrLevel = (typeof BASE_CEFR_LEVELS)[number];

/** Levels accepted by `/api/profile` PATCH (no A0). */
export const PROFILE_CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
export type ProfileCefrLevel = (typeof PROFILE_CEFR_LEVELS)[number];

export const HSK_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export type HskLevel = (typeof HSK_LEVELS)[number];

const CEFR_TO_HSK: Record<CefrLevel, HskLevel> = {
  A0: 1,
  A1: 2,
  A2: 3,
  B1: 4,
  B2: 5,
  C1: 6,
};

const HSK_TO_CEFR: Record<HskLevel, CefrLevel> = {
  1: "A0",
  2: "A1",
  3: "A2",
  4: "B1",
  5: "B2",
  6: "C1",
};

export type LevelBandOption = {
  /** Stored / sent to generation APIs */
  cefr: CefrLevel;
  hsk: HskLevel;
  label: string;
  sublabel: string;
  note?: string;
};

/** Journey onboarding self-assess options (includes A0 / HSK 1). */
export const JOURNEY_LEVEL_OPTIONS: readonly LevelBandOption[] = [
  {
    cefr: "A0",
    hsk: 1,
    label: "Just starting out",
    sublabel: "I don't know any Mandarin yet",
    note: "Everyone starts here. LingoIsland is built for this.",
  },
  {
    cefr: "A1",
    hsk: 2,
    label: "I know a little",
    sublabel: "Greetings, numbers, basic phrases",
  },
  {
    cefr: "A2",
    hsk: 3,
    label: "Getting the basics",
    sublabel: "Simple exchanges, some characters",
  },
  {
    cefr: "B1",
    hsk: 4,
    label: "Simple conversations",
    sublabel: "I get by but have big gaps",
  },
  {
    cefr: "B2",
    hsk: 5,
    label: "Conversational",
    sublabel: "I speak but vocabulary holds me back",
  },
  {
    cefr: "C1",
    hsk: 6,
    label: "Pretty fluent",
    sublabel: "Filling specific areas",
  },
] as const;

/** Settings / create flows that omit the fixed A0 course band. */
export const PROFILE_LEVEL_OPTIONS: readonly {
  cefr: ProfileCefrLevel;
  hsk: HskLevel;
  label: string;
}[] = [
  { cefr: "A1", hsk: 2, label: "Beginner" },
  { cefr: "A2", hsk: 3, label: "Elementary" },
  { cefr: "B1", hsk: 4, label: "Intermediate" },
  { cefr: "B2", hsk: 5, label: "Upper intermediate" },
  { cefr: "C1", hsk: 6, label: "Advanced" },
] as const;

export function isCefrLevel(value: string): value is CefrLevel {
  return (BASE_CEFR_LEVELS as readonly string[]).includes(value);
}

/** Maps stored profile values (including legacy A1-/A1+ style) to a base band. */
export function cefrFromProfile(raw: string | null | undefined): CefrLevel {
  if (!raw) return "B1";
  const t = raw.trim();
  if (isCefrLevel(t)) return t;
  const m = t.toUpperCase().match(/^(A0|A1|A2|B1|B2|C1)/);
  if (m && isCefrLevel(m[1])) return m[1];
  return "B1";
}

export function cefrToHsk(cefr: string | null | undefined): HskLevel {
  return CEFR_TO_HSK[cefrFromProfile(cefr)];
}

export function hskToCefr(hsk: number): CefrLevel {
  if (hsk >= 1 && hsk <= 6) return HSK_TO_CEFR[hsk as HskLevel];
  return "B1";
}

/** User-facing badge, e.g. "HSK 4". */
export function hskLabelForCefr(cefr: string | null | undefined): string {
  return `HSK ${cefrToHsk(cefr)}`;
}

export function hskLabel(hsk: number): string {
  return formatHskLevel(hsk);
}

/** Profile fields to keep HSK track aligned when the user picks a band. */
export function hskProfileFieldsFromCefr(
  cefr: string,
  opts?: { setTarget?: boolean; targetLevel?: number },
): {
  hsk_current_level: HskLevel;
  hsk_target_level?: number;
} {
  const current = cefrToHsk(cefr);
  const fields: {
    hsk_current_level: HskLevel;
    hsk_target_level?: number;
  } = {
    hsk_current_level: current,
  };
  if (opts?.setTarget) {
    fields.hsk_target_level =
      opts.targetLevel ?? Math.min(Math.max(current + 1, 2), HSK_MAX_LEVEL);
  }
  return fields;
}
