// Huahua preferences chosen during onboarding, and how they map onto the
// existing SMS preference columns.

import { defaultSupportStyle, type SupportStyle } from "./plan";

export type CorrectionChoice = "gentle" | "balanced" | "direct" | "auto";
export type FrequencyChoice = "2" | "3" | "5" | "7" | "auto";
export type WritingSystem = "simplified" | "traditional";

export const CORRECTION_CHOICES: ReadonlyArray<{ key: CorrectionChoice; label: string; description: string }> = [
  { key: "gentle", label: "Gentle corrections", description: "Huahua models the right phrase without stopping the chat" },
  { key: "balanced", label: "Balanced corrections", description: "Small slips are recast, bigger ones get a short note" },
  { key: "direct", label: "Direct corrections", description: "Clear corrections with a quick explanation" },
  { key: "auto", label: "Adjust automatically", description: "Huahua adapts to how you are doing" },
];

export const SUPPORT_QUESTION = "How much help would you like while texting in Mandarin?";

export const FREQUENCY_CHOICES: ReadonlyArray<{ key: FrequencyChoice; label: string }> = [
  { key: "2", label: "2 times" },
  { key: "3", label: "3 times" },
  { key: "5", label: "5 times" },
  { key: "7", label: "Every day" },
  { key: "auto", label: "Adjust automatically" },
];

export const WRITING_SYSTEMS: ReadonlyArray<{ key: WritingSystem; label: string; sample: string; usedIn: string }> = [
  { key: "simplified", label: "Simplified Chinese", sample: "学习中文", usedIn: "Used in mainland China, Singapore, and Malaysia" },
  { key: "traditional", label: "Traditional Chinese", sample: "學習中文", usedIn: "Used in Taiwan, Hong Kong, and Macau" },
];

export const FREQUENCY_QUESTION = "I don\u2019t want to annoy you, so how often can I text you during the week? \u{1F60A}";

export const DEFAULT_QUIET_START = 21 * 60;
export const DEFAULT_QUIET_END = 8 * 60;

export type OnboardingHuahuaPrefs = {
  support: SupportStyle;
  correction: CorrectionChoice;
  writingSystem: WritingSystem;
  frequency: FrequencyChoice;
  timezone: string;
  /** Minutes after local midnight. */
  quietStart: number;
  quietEnd: number;
};

export function isCorrectionChoice(value: unknown): value is CorrectionChoice {
  return CORRECTION_CHOICES.some((option) => option.key === value);
}
export function isFrequencyChoice(value: unknown): value is FrequencyChoice {
  return FREQUENCY_CHOICES.some((option) => option.key === value);
}
export function isWritingSystem(value: unknown): value is WritingSystem {
  return value === "simplified" || value === "traditional";
}
export function isSupportStyle(value: unknown): value is SupportStyle {
  return value === "full" || value === "on_request" || value === "mostly_chinese" || value === "auto";
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function isMinuteOfDay(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 1440;
}

export function defaultHuahuaPrefs(level: number, timezone: string): OnboardingHuahuaPrefs {
  return {
    support: defaultSupportStyle(level),
    correction: "gentle",
    writingSystem: "simplified",
    frequency: "auto",
    timezone: isValidTimeZone(timezone) ? timezone : "UTC",
    quietStart: DEFAULT_QUIET_START,
    quietEnd: DEFAULT_QUIET_END,
  };
}

/** Validates untrusted input; unknown or invalid fields fall back to the defaults. */
export function parseHuahuaPrefs(input: unknown, fallback: OnboardingHuahuaPrefs): OnboardingHuahuaPrefs {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const quietStart = isMinuteOfDay(raw.quietStart) ? raw.quietStart : fallback.quietStart;
  let quietEnd = isMinuteOfDay(raw.quietEnd) ? raw.quietEnd : fallback.quietEnd;
  if (quietEnd === quietStart) quietEnd = fallback.quietEnd === quietStart ? (quietStart + 60) % 1440 : fallback.quietEnd;
  return {
    support: isSupportStyle(raw.support) ? raw.support : fallback.support,
    correction: isCorrectionChoice(raw.correction) ? raw.correction : fallback.correction,
    writingSystem: isWritingSystem(raw.writingSystem) ? raw.writingSystem : fallback.writingSystem,
    frequency: isFrequencyChoice(raw.frequency) ? raw.frequency : fallback.frequency,
    timezone: isValidTimeZone(raw.timezone) ? raw.timezone : fallback.timezone,
    quietStart,
    quietEnd,
  };
}

export function scaffoldingFor(support: SupportStyle): "more" | "on_request" | "less" | "auto" {
  if (support === "full") return "more";
  if (support === "on_request") return "on_request";
  if (support === "mostly_chinese") return "less";
  return "auto";
}

export function correctionModeFor(choice: CorrectionChoice): "gentle" | "balanced" | "coach" | "auto" {
  return choice === "direct" ? "coach" : choice;
}

/** Patch for sms_update_preferences. */
export function toSmsPreferencePatch(prefs: OnboardingHuahuaPrefs) {
  return {
    scaffolding: scaffoldingFor(prefs.support),
    correction_mode: correctionModeFor(prefs.correction),
    writing_system: prefs.writingSystem,
    timezone: prefs.timezone,
    quiet_start: prefs.quietStart,
    quiet_end: prefs.quietEnd,
    openers_per_week: prefs.frequency === "auto" ? null : Number(prefs.frequency),
    auto_adjust: true,
  };
}

export function supportPhrase(support: SupportStyle) {
  switch (support) {
    case "full":
      return "Chinese with pinyin and English";
    case "on_request":
      return "Chinese with help when you ask";
    case "mostly_chinese":
      return "mostly Chinese";
    default:
      return "support that adjusts as you go";
  }
}

export function formatMinuteOfDay(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** "21:00" style value for <input type="time">. */
export function minuteToTimeValue(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function timeValueToMinute(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}
