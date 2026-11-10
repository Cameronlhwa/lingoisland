// The stored "Did we get this right?" playback. Kept free of flow imports so
// flow.ts can parse it without a circular dependency.

export type InsightSource = "ai" | "template";

/** Dan Martell's playback: where you are, where you want to be, what's really in the way. */
export type InsightAnswer = {
  /** Fingerprint of the answers it was written from; a mismatch means it's stale. */
  key: string;
  now: string;
  goal: string;
  missing: string;
  source: InsightSource;
};

export const INSIGHT_FIELD_MAX = 240;

function cleanLine(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[<>{}\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, INSIGHT_FIELD_MAX);
  return text.length >= 3 ? text : null;
}

/** Untrusted input (local storage, server rows): returns null unless every field is usable. */
export function parseInsight(value: unknown): InsightAnswer | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const key = typeof raw.key === "string" && /^[a-z0-9]{1,16}$/.test(raw.key) ? raw.key : null;
  const now = cleanLine(raw.now);
  const goal = cleanLine(raw.goal);
  const missing = cleanLine(raw.missing);
  const source: InsightSource | null = raw.source === "ai" || raw.source === "template" ? raw.source : null;
  if (!key || !now || !goal || !missing || !source) return null;
  return { key, now, goal, missing, source };
}
