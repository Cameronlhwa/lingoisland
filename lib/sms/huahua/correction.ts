export type CorrectionMode = "gentle" | "balanced" | "coach" | "hint_first" | "conversation_only" | "auto";

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
    key: "balanced",
    label: "Balanced",
    description: "Natural recasts for small slips, a short note for mistakes that matter.",
    prompt:
      "Corrections (balanced): recast small slips naturally in your reply. For a mistake that changes the meaning, add one short, friendly note with the corrected phrase. Never more than one note per message.",
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
  {
    key: "auto",
    label: "Adjust automatically",
    description: "Huahua adapts how much it corrects to how you are doing.",
    prompt:
      "Corrections (adaptive): for beginners or when the learner seems unsure, recast gently without stopping the chat. When the learner is writing confidently or repeats the same mistake, add one short, clear correction.",
  },
];

export const DEFAULT_CORRECTION_MODE: CorrectionMode = "gentle";

export function isCorrectionMode(value: unknown): value is CorrectionMode {
  return CORRECTION_MODES.some((mode) => mode.key === value);
}

export function getCorrectionMode(key: string | null | undefined) {
  return CORRECTION_MODES.find((mode) => mode.key === key) ?? CORRECTION_MODES[0];
}
