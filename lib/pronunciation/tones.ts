/** 5 represents neutral tone; null represents missing or unknown tone evidence. */
export type Tone = 1 | 2 | 3 | 4 | 5;
export type ToneContext = { previousTone?: number | null; connectedSpeech?: boolean };

export function asTone(value: unknown): Tone | null {
  if (value === 0 || value === 5) return 5;
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : null;
}

export function neutralToneTip(previousTone?: number | null): string {
  if (previousTone === 3) return "Keep it short and light, at a higher pitch after the low third tone.";
  if (previousTone === 4) return "Keep it short and light, staying low after the falling fourth tone.";
  if (previousTone === 1 || previousTone === 2) return "Keep it short and light, lower than the end of the preceding tone.";
  return "Keep it short and light. Its pitch depends on the preceding tone; after a third tone, it is usually higher.";
}
