// Deterministic plan building: schedule, support defaults, milestone, and the
// first Journeys. Server and client run the same rules so the preview,
// commitment card, and saved plan always agree.

import { getInterest, goalPhrase, interestLabels, joinList, type GoalKey } from "./goals";
import { cefrForLevel, clampLevel, isBeginnerLevel, levelLabel, startingPointLabel, type InternalLevel } from "./levels";

export const PLAN_VERSION = 1;

export type MinutesKey = "5" | "10" | "15" | "30" | "60" | "60_plus";
export type DaysKey = "2" | "3" | "5" | "7" | "varies";
export type SessionPreference = "one_session" | "short_sessions" | "auto";

export const MINUTES_OPTIONS: ReadonlyArray<{ key: MinutesKey; label: string; minutes: number }> = [
  { key: "5", label: "5 minutes", minutes: 5 },
  { key: "10", label: "10 minutes", minutes: 10 },
  { key: "15", label: "15 minutes", minutes: 15 },
  { key: "30", label: "30 minutes", minutes: 30 },
  { key: "60", label: "About 1 hour", minutes: 60 },
  { key: "60_plus", label: "More than 1 hour", minutes: 90 },
];

export const DAYS_OPTIONS: ReadonlyArray<{ key: DaysKey; label: string; days: number }> = [
  { key: "2", label: "2 days", days: 2 },
  { key: "3", label: "3 days", days: 3 },
  { key: "5", label: "5 days", days: 5 },
  { key: "7", label: "Every day", days: 7 },
  { key: "varies", label: "It changes week to week", days: 3 },
];

export const SESSION_OPTIONS: ReadonlyArray<{ key: SessionPreference; label: string }> = [
  { key: "one_session", label: "One longer session" },
  { key: "short_sessions", label: "A few shorter sessions" },
  { key: "auto", label: "Adjust it for me" },
];

export function isMinutesKey(value: unknown): value is MinutesKey {
  return MINUTES_OPTIONS.some((option) => option.key === value);
}
export function isDaysKey(value: unknown): value is DaysKey {
  return DAYS_OPTIONS.some((option) => option.key === value);
}
export function isSessionPreference(value: unknown): value is SessionPreference {
  return SESSION_OPTIONS.some((option) => option.key === value);
}

export function minutesFor(key: MinutesKey | null | undefined) {
  return MINUTES_OPTIONS.find((option) => option.key === key)?.minutes ?? 10;
}
export function daysFor(key: DaysKey | null | undefined) {
  return DAYS_OPTIONS.find((option) => option.key === key)?.days ?? 3;
}

/** The session-split question appears only for 30 minutes or more. */
export function needsSessionPreference(key: MinutesKey | null | undefined) {
  return minutesFor(key) >= 30;
}

export type SupportStyle = "full" | "on_request" | "mostly_chinese" | "auto";

export const SUPPORT_OPTIONS: ReadonlyArray<{ key: SupportStyle; label: string; description: string }> = [
  { key: "full", label: "Chinese, pinyin, and English", description: "Full support on every message" },
  { key: "on_request", label: "Chinese with help when requested", description: "Text PINYIN or ENGLISH whenever you want help" },
  { key: "mostly_chinese", label: "Mostly Chinese", description: "Help only for new or tricky words" },
  { key: "auto", label: "Adjust automatically", description: "Huahua follows how you are doing" },
];

export function defaultSupportStyle(level: number): SupportStyle {
  if (level <= 1) return "full";
  if (level <= 3) return "on_request";
  return "mostly_chinese";
}

export type SupportRecommendation = {
  pinyin: "always" | "on_request" | "new_words";
  translation: "always" | "on_request" | "new_words";
  toneSupport: "standard" | "extra";
  summary: string;
};

export function supportRecommendation(level: number, toneSupport: "standard" | "extra" = "standard"): SupportRecommendation {
  if (level <= 1) {
    return {
      pinyin: "always",
      translation: "always",
      toneSupport,
      summary: "Pinyin and English on everything, so nothing feels like a guess.",
    };
  }
  if (level <= 3) {
    return {
      pinyin: toneSupport === "extra" ? "always" : "on_request",
      translation: "on_request",
      toneSupport,
      summary: toneSupport === "extra"
        ? "Pinyin shown by default, with English whenever you want it."
        : "Pinyin and English whenever you want them.",
    };
  }
  return {
    pinyin: "new_words",
    translation: "new_words",
    toneSupport,
    summary: "Pinyin and English for new or tricky words.",
  };
}

export type MilestoneKey = "beginner" | "early" | "intermediate" | "advanced" | "business" | "heritage" | "travel" | "school";

type MilestoneRule = { key: MilestoneKey; text: string; weeks: [number, number] };

const MILESTONES: Record<MilestoneKey, MilestoneRule> = {
  beginner: { key: "beginner", text: "handling simple introductions and everyday phrases", weeks: [8, 12] },
  early: { key: "early", text: "holding short conversations about familiar topics", weeks: [13, 22] },
  intermediate: { key: "intermediate", text: "talking about your work, studies, and interests with more ease", weeks: [13, 22] },
  advanced: { key: "advanced", text: "expressing complex ideas more precisely and naturally", weeks: [17, 26] },
  business: { key: "business", text: "handling basic client and professional situations", weeks: [8, 12] },
  heritage: { key: "heritage", text: "joining simple family conversations with more confidence", weeks: [8, 12] },
  travel: { key: "travel", text: "ordering food, getting around, and handling common travel situations", weeks: [6, 10] },
  school: { key: "school", text: "following and joining everyday conversations about your classes", weeks: [8, 12] },
};

export function milestoneKeyFor(goal: GoalKey | null, level: number): MilestoneKey {
  const beginnerish = level <= 2;
  if (goal === "travel" && level <= 3) return "travel";
  if (goal === "work" && beginnerish) return "business";
  if (goal === "heritage" && beginnerish) return "heritage";
  if (goal === "school" && beginnerish && level >= 1) return "school";
  if (level <= 1) return "beginner";
  if (level <= 3) return "early";
  if (level <= 4) return "intermediate";
  return "advanced";
}

/** Fewer weekly minutes stretch the range; more minutes never shrink it below the base. */
export function scaleWeeks(base: [number, number], weeklyMinutes: number): [number, number] {
  const factor = weeklyMinutes < 30 ? 1.5 : weeklyMinutes < 60 ? 1.25 : 1;
  return [Math.round(base[0] * factor), Math.round(base[1] * factor)];
}

export function formatRange([low, high]: [number, number]): string {
  if (high <= 16) return `${low} to ${high} weeks`;
  const months = (weeks: number) => Math.max(1, Math.round(weeks / 4.345));
  const lowMonths = months(low);
  const highMonths = Math.max(lowMonths + 1, months(high));
  return `${lowMonths} to ${highMonths} months`;
}

export type JourneySuggestion = { key: string; title: string; minutes: number };

const JOURNEYS: Record<string, { title: string; beginner: string }> = {
  clients: { title: "Building rapport with clients", beginner: "Greeting a client" },
  finance: { title: "Talking about numbers and budgets", beginner: "Numbers and prices at work" },
  meetings: { title: "Speaking up in meetings", beginner: "Introducing yourself in a meeting" },
  networking: { title: "Small talk at networking events", beginner: "Saying who you are and what you do" },
  sales: { title: "Presenting a product", beginner: "Describing what your company does" },
  technology: { title: "Talking about tech at work", beginner: "Everyday tech words" },
  entrepreneurship: { title: "Pitching your idea", beginner: "Talking about your business" },
  school_life: { title: "A day on campus", beginner: "Classroom basics" },
  presentations: { title: "Giving a short presentation", beginner: "Introducing your topic" },
  science: { title: "Explaining a science idea", beginner: "Science words you see in class" },
  engineering: { title: "Describing how things work", beginner: "Tools and projects" },
  medicine: { title: "Talking about health", beginner: "At the doctor" },
  current_events: { title: "Chatting about the news", beginner: "What happened today" },
  family_conversations: { title: "Catching up with family", beginner: "Greeting your family" },
  food: { title: "Talking about food you love", beginner: "Ordering your favorite dish" },
  traditions: { title: "Holidays and traditions", beginner: "Holiday greetings" },
  childhood: { title: "Sharing childhood memories", beginner: "Talking about when you were young" },
  everyday_life: { title: "Your daily routine", beginner: "Talking about your day" },
  restaurants: { title: "Ordering at a restaurant", beginner: "Ordering food and drinks" },
  transportation: { title: "Getting around the city", beginner: "Taking a taxi" },
  hotels: { title: "Checking in at a hotel", beginner: "Asking for your room" },
  shopping: { title: "Shopping and bargaining", beginner: "Asking how much it costs" },
  sightseeing: { title: "Asking for directions while sightseeing", beginner: "Finding your way" },
  meeting_locals: { title: "Making friends with locals", beginner: "Introducing yourself" },
  friends: { title: "Making plans with friends", beginner: "Saying hi to a friend" },
  entertainment: { title: "Movies, shows, and music", beginner: "Saying what you like to watch" },
  hobbies: { title: "Talking about your hobbies", beginner: "Saying what you enjoy" },
  relationships: { title: "Talking about the people in your life", beginner: "Describing people you know" },
};

export function firstJourneys(input: { interestKeys: readonly string[]; customInterest?: string | null; level: number; minutesPerDay: number }): JourneySuggestion[] {
  const beginner = isBeginnerLevel(input.level);
  const minutes = Math.min(input.minutesPerDay, beginner ? 10 : 20);
  const picks: JourneySuggestion[] = [];
  input.interestKeys.forEach((key) => {
    const entry = JOURNEYS[key];
    if (!entry || picks.length >= 3) return;
    picks.push({ key, title: beginner ? entry.beginner : entry.title, minutes });
  });
  if (input.customInterest && picks.length < 3) {
    picks.push({ key: "custom", title: `Talking about ${input.customInterest}`, minutes });
  }
  if (picks.length < 2) {
    const fallback = beginner ? JOURNEYS.everyday_life.beginner : JOURNEYS.everyday_life.title;
    if (!picks.some((pick) => pick.title === fallback)) picks.push({ key: "everyday_life", title: fallback, minutes });
  }
  if (picks.length < 2) {
    picks.push({ key: "food", title: beginner ? JOURNEYS.food.beginner : JOURNEYS.food.title, minutes });
  }
  return picks.slice(0, 3);
}

const GOAL_BENEFITS: Record<GoalKey, string> = {
  work: "Learn the Mandarin you need for clients and professional situations.",
  school: "Focus on the Mandarin that appears in your classes, subjects, and school life.",
  heritage: "Turn the Mandarin you recognize into language you can confidently use with family.",
  travel: "Prepare for the situations you will actually encounter.",
  everyday: "Build Mandarin you can use in real conversations about the things you enjoy.",
  other: "Build Mandarin you can use in real conversations about the things you enjoy.",
};

export const BEGINNER_BENEFIT = "Start with small, useful steps without feeling overwhelmed.";

export function goalBenefit(goal: GoalKey | null, level: number): string {
  if (level === 0) return BEGINNER_BENEFIT;
  return GOAL_BENEFITS[goal ?? "everyday"];
}

export type PlanInput = {
  goal: GoalKey | null;
  secondaryGoal?: GoalKey | null;
  goalOtherText?: string | null;
  interestKeys: readonly string[];
  customInterest?: string | null;
  provisionalLevel: number;
  minutes: MinutesKey | null;
  days: DaysKey | null;
  sessionPreference?: SessionPreference | null;
  toneSupport?: "standard" | "extra";
};

export type LearningPlan = {
  version: number;
  goal: GoalKey | null;
  secondaryGoal: GoalKey | null;
  goalPhrase: string;
  benefit: string;
  interests: string[];
  interestPhrase: string;
  level: InternalLevel;
  levelLabel: string;
  startingPoint: string;
  cefr: string;
  minutesPerDay: number;
  minutesLabel: string;
  daysPerWeek: number;
  daysLabel: string;
  daysVary: boolean;
  sessionPreference: SessionPreference | null;
  sessionSplit: string | null;
  support: SupportRecommendation;
  defaultSupportStyle: SupportStyle;
  milestone: { key: MilestoneKey; text: string; range: string; weeks: [number, number] };
  journeys: JourneySuggestion[];
  /** Topic used for the first generated Journey. */
  journeyTopic: string;
};

export function buildPlan(input: PlanInput): LearningPlan {
  const level = clampLevel(input.provisionalLevel);
  const minutesPerDay = minutesFor(input.minutes);
  const daysPerWeek = daysFor(input.days);
  const weeklyMinutes = minutesPerDay * daysPerWeek;
  const milestoneRule = MILESTONES[milestoneKeyFor(input.goal, level)];
  const weeks = scaleWeeks(milestoneRule.weeks, weeklyMinutes);
  const interests = interestLabels(input.interestKeys, input.customInterest ?? null);
  const journeys = firstJourneys({
    interestKeys: input.interestKeys,
    customInterest: input.customInterest,
    level,
    minutesPerDay,
  });
  const sessionPreference = needsSessionPreference(input.minutes) ? input.sessionPreference ?? "auto" : null;
  const sessionSplit = sessionPreference === "one_session"
    ? `One ${minutesPerDay}-minute session`
    : sessionPreference === "short_sessions"
      ? `${minutesPerDay >= 60 ? 3 : 2} shorter sessions`
      : sessionPreference === "auto"
        ? "We will balance session length for you"
        : null;

  return {
    version: PLAN_VERSION,
    goal: input.goal,
    secondaryGoal: input.secondaryGoal ?? null,
    goalPhrase: goalPhrase(input.goal, input.goalOtherText),
    benefit: goalBenefit(input.goal, level),
    interests,
    interestPhrase: joinList([
      ...input.interestKeys.map((key) => getInterest(key)?.label.toLowerCase()).filter((label): label is string => Boolean(label)),
      ...(input.customInterest ? [input.customInterest] : []),
    ]),
    level,
    levelLabel: levelLabel(level),
    startingPoint: startingPointLabel(level),
    cefr: cefrForLevel(level),
    minutesPerDay,
    minutesLabel: MINUTES_OPTIONS.find((option) => option.key === input.minutes)?.label ?? `${minutesPerDay} minutes`,
    daysPerWeek,
    daysLabel: input.days === "varies" ? "a flexible number of days" : input.days === "7" ? "every day" : `${daysPerWeek} days`,
    daysVary: input.days === "varies",
    sessionPreference,
    sessionSplit,
    support: supportRecommendation(level, input.toneSupport ?? "standard"),
    defaultSupportStyle: defaultSupportStyle(level),
    milestone: { key: milestoneRule.key, text: milestoneRule.text, range: formatRange(weeks), weeks },
    journeys,
    journeyTopic: journeys[0]?.title ?? (getInterest(input.interestKeys[0] ?? "")?.label ?? "Everyday conversations"),
  };
}
