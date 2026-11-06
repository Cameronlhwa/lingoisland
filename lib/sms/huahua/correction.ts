export type CorrectionMode = "gentle" | "coach" | "hint_first" | "conversation_only";

export const CORRECTION_MODES: readonly {
  key: CorrectionMode;
  label: string;
  description: string;
  prompt: string;
}[] = [
  {
    key: "gentle",
    label: "Gentle",
    description: "Huahua naturally repeats the correct version without stopping the chat.",
    prompt:
      "Corrections (gentle): if the learner makes a meaningful mistake, naturally reuse the correct form in your reply (a recast). Fix at most one thing and don't lecture.",
  },
  {
    key: "coach",
    label: "Coach",
    description: "Clear corrections with a short explanation.",
    prompt:
      "Corrections (coach): point out up to two mistakes clearly, show the corrected sentence, and give a one-line explanation in simple English.",
  },
  {
    key: "hint_first",
    label: "Hint first",
    description: "A hint so you can fix it yourself before Huahua gives the answer.",
    prompt:
      "Corrections (hint first): when there's a mistake, give a short hint about what to fix and ask the learner to try again. Only give the full correction if they ask or try twice.",
  },
  {
    key: "conversation_only",
    label: "Conversation only",
    description: "No corrections, just keep the conversation going.",
    prompt:
      "Corrections (off): do not correct mistakes. Keep the conversation flowing; only ask for clarification if the meaning is unclear.",
  },
];

export const DEFAULT_CORRECTION_MODE: CorrectionMode = "gentle";

export function isCorrectionMode(value: unknown): value is CorrectionMode {
  return CORRECTION_MODES.some((mode) => mode.key === value);
}

export function getCorrectionMode(key: string | null | undefined) {
  return CORRECTION_MODES.find((mode) => mode.key === key) ?? CORRECTION_MODES[0];
}
