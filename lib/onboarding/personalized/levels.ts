// Self-reported level options and the internal 0–6 scale used by the
// assessment: 0 is pre-HSK, 1–6 are HSK levels.

export type InternalLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const MIN_LEVEL: InternalLevel = 0;
export const MAX_LEVEL: InternalLevel = 6;

export type SelfReportKey =
  | "new"
  | "few_words"
  | "simple_sentences"
  | "basic_conversations"
  | "familiar_topics"
  | "complex_topics";

export type SelfReportOption = {
  key: SelfReportKey;
  label: string;
  description: string;
  level: InternalLevel;
  /** Internal mapping only; never shown on this screen. */
  internalLabel: string;
};

export const SELF_REPORT_OPTIONS: readonly SelfReportOption[] = [
  { key: "new", label: "I am completely new", description: "I have not studied Mandarin yet", level: 0, internalLabel: "Pre-HSK" },
  { key: "few_words", label: "I know a few words", description: "Greetings, numbers, a handful of phrases", level: 1, internalLabel: "HSK 1" },
  { key: "simple_sentences", label: "I can make simple sentences", description: "Short sentences about myself and my day", level: 2, internalLabel: "HSK 2" },
  { key: "basic_conversations", label: "I can handle basic conversations", description: "Everyday exchanges with some pauses", level: 3, internalLabel: "HSK 3" },
  { key: "familiar_topics", label: "I can discuss familiar topics", description: "Work, studies, or interests with some gaps", level: 4, internalLabel: "HSK 4" },
  { key: "complex_topics", label: "I can discuss complex topics", description: "Opinions and abstract ideas, refining accuracy", level: 5, internalLabel: "HSK 5 or 6" },
];

export function isSelfReportKey(value: unknown): value is SelfReportKey {
  return typeof value === "string" && SELF_REPORT_OPTIONS.some((option) => option.key === value);
}

export function levelForSelfReport(key: SelfReportKey | null | undefined): InternalLevel | null {
  return SELF_REPORT_OPTIONS.find((option) => option.key === key)?.level ?? null;
}

export function clampLevel(value: number): InternalLevel {
  return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.round(value))) as InternalLevel;
}

export function levelLabel(level: number): string {
  const clamped = clampLevel(level);
  return clamped === 0 ? "Pre-HSK" : `HSK ${clamped}`;
}

/** Friendly starting-point description shown on the plan; never a score. */
export function startingPointLabel(level: number): string {
  const clamped = clampLevel(level);
  const names: Record<InternalLevel, string> = {
    0: "First steps",
    1: "Beginner foundations",
    2: "Building simple sentences",
    3: "Everyday conversations",
    4: "Familiar topics",
    5: "Complex topics",
    6: "Advanced fluency",
  };
  return `${names[clamped]} (${levelLabel(clamped)})`;
}

const CEFR_BY_LEVEL: Record<InternalLevel, "A0" | "A1" | "A2" | "B1" | "B2" | "C1"> = {
  0: "A0",
  1: "A0",
  2: "A1",
  3: "A2",
  4: "B1",
  5: "B2",
  6: "C1",
};

/** Content generation and `user_profiles.cefr_level` use CEFR bands (lib/levelBands.ts). */
export function cefrForLevel(level: number) {
  return CEFR_BY_LEVEL[clampLevel(level)];
}

/** `user_profiles.hsk_current_level` and Huahua scaffolding use HSK 1–6. */
export function hskForLevel(level: number): 1 | 2 | 3 | 4 | 5 | 6 {
  return Math.max(1, clampLevel(level)) as 1 | 2 | 3 | 4 | 5 | 6;
}

export function isBeginnerLevel(level: number | null | undefined) {
  return level !== null && level !== undefined && level <= 1;
}
