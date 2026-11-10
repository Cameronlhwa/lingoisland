// Pain questions for the personalized onboarding flow: how long they have been
// learning, what goes wrong when they use Mandarin, and what has made learning
// hard (or, for people who have not started, what has held them back).
// Keys are stored and sent to analytics; labels are display-only.

import type { GoalKey } from "./goals";

export const MAX_PAIN_PICKS = 2;

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

export type ExperienceKey = "not_started" | "under_6_months" | "6_to_24_months" | "over_2_years" | "on_and_off" | "as_a_kid";

export const EXPERIENCE_OPTIONS: readonly { key: ExperienceKey; label: string }[] = [
  { key: "not_started", label: "I haven't really started" },
  { key: "under_6_months", label: "Less than 6 months" },
  { key: "6_to_24_months", label: "6 months to 2 years" },
  { key: "over_2_years", label: "More than 2 years" },
  { key: "on_and_off", label: "On and off for years" },
  { key: "as_a_kid", label: "I learned some as a kid" },
];

export function isExperienceKey(value: unknown): value is ExperienceKey {
  return typeof value === "string" && EXPERIENCE_OPTIONS.some((option) => option.key === value);
}

// ---------------------------------------------------------------------------
// Using pain (what goes wrong when Mandarin comes up), per goal
// ---------------------------------------------------------------------------

export type UsingPainKey =
  | "stay_quiet"
  | "rely_on_translator"
  | "cant_keep_going"
  | "missing_opportunities"
  | "lost_in_class"
  | "hard_to_connect"
  | "exam_pressure"
  | "understand_cant_reply"
  | "family_switches"
  | "limited_with_elders"
  | "feel_disconnected"
  | "point_and_gesture"
  | "cant_talk_locals"
  | "worried_get_around"
  | "cant_follow_shows"
  | "something_else"
  | "want_to_improve";

export type PainOption<K extends string> = { key: K; label: string };

/** Exclusive: picking it clears the others, and the others clear it. */
export const NO_PAIN_KEY: UsingPainKey = "want_to_improve";

/** Opens a short text box for a pain we didn't list. */
export const CUSTOM_PAIN_KEY: UsingPainKey = "something_else";
export const CUSTOM_PAIN_MAX = 60;

const WANT_TO_IMPROVE: PainOption<UsingPainKey> = { key: "want_to_improve", label: "It's fine, I just want to get better" };
const SOMETHING_ELSE: PainOption<UsingPainKey> = { key: "something_else", label: "Something else" };
const CANT_KEEP_GOING: PainOption<UsingPainKey> = { key: "cant_keep_going", label: "I can say hello, but can't keep the conversation going" };

const USING_PAIN_BY_GOAL: Record<GoalKey, readonly PainOption<UsingPainKey>[]> = {
  work: [
    { key: "stay_quiet", label: "I stay quiet when colleagues speak Mandarin" },
    { key: "rely_on_translator", label: "Someone has to translate for me" },
    CANT_KEEP_GOING,
    { key: "missing_opportunities", label: "I'm missing chances with clients, roles or deals" },
    SOMETHING_ELSE,
    WANT_TO_IMPROVE,
  ],
  school: [
    { key: "lost_in_class", label: "I get lost in class or lectures" },
    { key: "hard_to_connect", label: "It's hard to connect with Chinese classmates" },
    { key: "exam_pressure", label: "I have an exam or requirement coming up" },
    CANT_KEEP_GOING,
    SOMETHING_ELSE,
    WANT_TO_IMPROVE,
  ],
  heritage: [
    { key: "understand_cant_reply", label: "I understand some, but I can't reply" },
    { key: "family_switches", label: "My family switches to English for me" },
    { key: "limited_with_elders", label: "I can't really talk with grandparents or older relatives" },
    { key: "feel_disconnected", label: "I feel disconnected from my roots" },
    SOMETHING_ELSE,
    WANT_TO_IMPROVE,
  ],
  travel: [
    { key: "point_and_gesture", label: "I end up pointing and using English" },
    { key: "cant_talk_locals", label: "I can't really talk with locals" },
    { key: "worried_get_around", label: "I worry about getting around on my own" },
    SOMETHING_ELSE,
    WANT_TO_IMPROVE,
  ],
  everyday: [
    { key: "stay_quiet", label: "I stay quiet when friends speak Mandarin" },
    CANT_KEEP_GOING,
    { key: "cant_follow_shows", label: "I can't follow shows or videos without subtitles" },
    SOMETHING_ELSE,
    WANT_TO_IMPROVE,
  ],
  other: [
    { key: "stay_quiet", label: "I stay quiet when friends speak Mandarin" },
    CANT_KEEP_GOING,
    { key: "cant_follow_shows", label: "I can't follow shows or videos without subtitles" },
    SOMETHING_ELSE,
    WANT_TO_IMPROVE,
  ],
};

const ALL_USING_PAIN_KEYS = new Set<string>(
  Object.values(USING_PAIN_BY_GOAL).flatMap((options) => options.map((option) => option.key)),
);

export function usingPainOptionsFor(goal: GoalKey | null): readonly PainOption<UsingPainKey>[] {
  return USING_PAIN_BY_GOAL[goal ?? "everyday"];
}

export function isUsingPainKey(value: unknown): value is UsingPainKey {
  return typeof value === "string" && ALL_USING_PAIN_KEYS.has(value);
}

export function usingPainLabel(key: UsingPainKey, goal: GoalKey | null): string {
  const own = usingPainOptionsFor(goal).find((option) => option.key === key);
  if (own) return own.label;
  for (const options of Object.values(USING_PAIN_BY_GOAL)) {
    const found = options.find((option) => option.key === key);
    if (found) return found.label;
  }
  return key;
}

/** Headline for the using-pain question, by goal. */
export function usingPainTitle(goal: GoalKey | null): string {
  switch (goal) {
    case "work":
      return "When Mandarin comes up at work, what usually happens?";
    case "school":
      return "When Mandarin comes up at school, what usually happens?";
    case "heritage":
      return "When Mandarin comes up with family, what usually happens?";
    case "travel":
      return "When you travel, what usually happens with Mandarin?";
    default:
      return "When Mandarin comes up, what usually happens?";
  }
}

// ---------------------------------------------------------------------------
// Timing: when they will next need it
// ---------------------------------------------------------------------------

export type TimingKey = "this_week" | "this_month" | "upcoming_event" | "ongoing" | "no_date";

export const TIMING_OPTIONS: readonly { key: TimingKey; label: string }[] = [
  { key: "this_week", label: "This week" },
  { key: "this_month", label: "Within a month" },
  { key: "upcoming_event", label: "A trip or event coming up" },
  { key: "ongoing", label: "It happens every week" },
  { key: "no_date", label: "No specific time" },
];

export function isTimingKey(value: unknown): value is TimingKey {
  return typeof value === "string" && TIMING_OPTIONS.some((option) => option.key === value);
}

/** The "What's coming up?" field only shows for a dated need. */
export function timingHasEvent(timing: TimingKey | null): boolean {
  return timing === "this_week" || timing === "this_month" || timing === "upcoming_event";
}

export function upcomingPlaceholder(goal: GoalKey | null): string {
  switch (goal) {
    case "work":
      return "For example, a client dinner in Shanghai";
    case "school":
      return "For example, my HSK 3 exam";
    case "heritage":
      return "For example, visiting my grandparents";
    case "travel":
      return "For example, two weeks in Beijing";
    default:
      return "For example, meeting my partner's family";
  }
}

// ---------------------------------------------------------------------------
// Learning pain (has studied) and hesitation (has not started)
// ---------------------------------------------------------------------------

export type LearningPainKey = "forget_words" | "not_relevant" | "freeze_speaking" | "plateau" | "inconsistent" | "no_practice" | "tones";

export const LEARNING_PAIN_OPTIONS: readonly PainOption<LearningPainKey>[] = [
  { key: "forget_words", label: "I forget words quickly" },
  { key: "not_relevant", label: "Lessons weren't about things I actually need" },
  { key: "freeze_speaking", label: "I recognize words but freeze when speaking" },
  { key: "plateau", label: "I've stopped improving" },
  { key: "inconsistent", label: "I don't have enough time" },
  { key: "no_practice", label: "I have no one to practise with" },
  { key: "tones", label: "Tones and pronunciation" },
];

export type HesitationKey = "no_time" | "seems_too_hard" | "dont_know_where_start" | "apps_felt_like_games" | "worried_quit";

export const HESITATION_OPTIONS: readonly PainOption<HesitationKey>[] = [
  { key: "no_time", label: "I don't have much time" },
  { key: "seems_too_hard", label: "It seems too hard (tones, characters)" },
  { key: "dont_know_where_start", label: "I didn't know where to start" },
  { key: "apps_felt_like_games", label: "Apps felt like games, not real Mandarin" },
  { key: "worried_quit", label: "I'm worried I'll quit" },
];

export function isLearningPainKey(value: unknown): value is LearningPainKey {
  return typeof value === "string" && LEARNING_PAIN_OPTIONS.some((option) => option.key === value);
}

export function isHesitationKey(value: unknown): value is HesitationKey {
  return typeof value === "string" && HESITATION_OPTIONS.some((option) => option.key === value);
}

// ---------------------------------------------------------------------------
// Selection helpers
// ---------------------------------------------------------------------------

/**
 * Toggles a key in a capped multi-select. Returns null when adding would
 * exceed the cap, so the UI can explain instead of silently dropping it.
 */
export function togglePick<K extends string>(selected: readonly K[], key: K, max = MAX_PAIN_PICKS, exclusive?: K): K[] | null {
  if (selected.includes(key)) return selected.filter((item) => item !== key);
  if (exclusive && key === exclusive) return [key];
  const base = exclusive ? selected.filter((item) => item !== exclusive) : [...selected];
  if (base.length >= max) return null;
  return [...base, key];
}

/** Dedupes, validates, caps, and enforces the exclusive key for untrusted input. */
export function cleanPicks<K extends string>(value: unknown, guard: (item: unknown) => item is K, max = MAX_PAIN_PICKS, exclusive?: K): K[] {
  if (!Array.isArray(value)) return [];
  const picks = value.filter(guard).filter((item, index, list) => list.indexOf(item) === index);
  if (exclusive && picks.includes(exclusive)) return [exclusive];
  return picks.slice(0, max);
}
