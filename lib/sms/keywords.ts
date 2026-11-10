export type SmsKeyword = "stop" | "start" | "help";

const STOP_WORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "optout", "revoke"]);
const START_WORDS = new Set(["start", "unstop", "optin"]);
const HELP_WORDS = new Set(["help", "info"]);

/** Carrier-style keywords: the whole message, case-insensitive. */
export function detectSmsKeyword(body: string): SmsKeyword | null {
  const normalized = body.trim().toLowerCase().replace(/[\s.!]+$/g, "").replace(/\s+/g, "");
  if (STOP_WORDS.has(normalized)) return "stop";
  if (START_WORDS.has(normalized)) return "start";
  if (HELP_WORDS.has(normalized)) return "help";
  return null;
}
