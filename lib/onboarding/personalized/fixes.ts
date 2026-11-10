// How LingoIsland fixes what the learner told us, written for someone who may
// not know any Mandarin terms yet (no "pinyin", "HSK" or "tones" jargon in
// titles). Shared by the reflection, the plan and the paywall so every screen
// makes the same promise. Only describe things the product actually does.

import { isBeginnerPath, type OnboardingAnswers } from "./flow";
import type { HesitationKey, LearningPainKey, UsingPainKey } from "./painPoints";
import type { LearningPlan } from "./plan";

export type Fix = {
  id: FixId;
  title: string;
  detail: string;
  /** One plain-English benefit (seven words or fewer), for pills and list items. */
  short: string;
  /** One short line that follows `short` ("Zero wasted lessons. Only the Mandarin you need."). */
  tagline: string;
};

export type FixId = "speak" | "practice" | "relevant" | "remember" | "hear" | "tones" | "time" | "level" | "next";

function topic(plan: LearningPlan): string {
  return plan.interests[0]?.toLowerCase() ?? "your life";
}

const FIXES: Record<FixId, (plan: LearningPlan) => Omit<Fix, "id">> = {
  speak: () => ({
    short: "Speak real Mandarin from day one",
    tagline: "No endless flashcards.",
    title: "Speak from your very first lesson",
    detail: "Real phrases you can say out loud the same day, not endless flashcards.",
  }),
  practice: (plan) => ({
    short: "Practice with your personal assistant",
    tagline: "Rehearse real conversations first.",
    title: "Rehearse the conversation before it\u2019s real",
    detail: `Chat in Mandarin about ${topic(plan)} and get gently corrected, with no one watching.`,
  }),
  relevant: (plan) => ({
    short: "Learn topics that you\u2019ll actually use",
    tagline: `Built around ${plan.interestPhrase || topic(plan)}.`,
    title: "Only the Mandarin you\u2019ll actually use",
    detail: `Every lesson is built around ${plan.interestPhrase || topic(plan)}. No \u201cthe apple is red.\u201d`,
  }),
  remember: () => ({
    short: "Reviews so words actually stick",
    tagline: "Each word comes back right before you\u2019d forget it.",
    title: "Words that finally stick",
    detail: "Quick reviews bring each word back right before you\u2019d forget it.",
  }),
  hear: () => ({
    short: "Hear how every word sounds",
    tagline: "Then say it right the first time.",
    title: "Never guess how a word sounds",
    detail: "Hear every word spoken, with an easy guide to say it right underneath.",
  }),
  tones: () => ({
    short: "Tone correction to sound more native",
    tagline: "See exactly which sounds were off.",
    title: "Hear exactly what you got wrong",
    detail: "Say a word and see which sound was off, so you fix it instead of guessing.",
  }),
  time: (plan) => ({
    short: `Lessons that fit in ${plan.minutesPerDay} minutes`,
    tagline: "Fits a coffee break.",
    title: "Built for a busy week",
    detail: `${plan.minutesPerDay}-minute lessons that fit a coffee break, on the days you chose.`,
  }),
  level: () => ({
    short: "Skip what you already know",
    tagline: "No relearning hello.",
    title: "Start above what you already know",
    detail: "No relearning hello. Lessons pick up where you are and move up as you improve.",
  }),
  next: () => ({
    short: "Your next lesson is always ready",
    tagline: "No planning, no guessing.",
    title: "Always know what to do next",
    detail: "Open the app and your next 10 minutes are ready. No planning, no guessing.",
  }),
};

const BY_STRUGGLE: Record<LearningPainKey | HesitationKey, FixId[]> = {
  forget_words: ["remember"],
  not_relevant: ["relevant"],
  freeze_speaking: ["practice", "speak"],
  plateau: ["level"],
  inconsistent: ["time"],
  no_practice: ["practice"],
  tones: ["tones", "hear"],
  no_time: ["time"],
  seems_too_hard: ["hear", "speak"],
  dont_know_where_start: ["next"],
  apps_felt_like_games: ["relevant", "speak"],
  worried_quit: ["time", "next"],
};

const BY_USING_PAIN: Partial<Record<UsingPainKey, FixId[]>> = {
  stay_quiet: ["practice"],
  rely_on_translator: ["practice"],
  cant_keep_going: ["practice"],
  understand_cant_reply: ["speak", "practice"],
  family_switches: ["practice"],
  limited_with_elders: ["practice"],
  point_and_gesture: ["speak"],
  cant_talk_locals: ["practice"],
};

/** The learner's own struggles first, then what their pain needs, then sensible defaults. */
export function fixesFor(answers: OnboardingAnswers, plan: LearningPlan, count = 3): Fix[] {
  const beginner = isBeginnerPath(answers);
  const struggles: (LearningPainKey | HesitationKey)[] = beginner ? answers.learningPain.hesitations : answers.learningPain.keys;
  const order: FixId[] = [
    ...struggles.flatMap((key) => BY_STRUGGLE[key]),
    ...answers.usingPain.keys.flatMap((key) => BY_USING_PAIN[key] ?? []),
    ...(beginner ? (["speak", "hear", "relevant", "practice"] as FixId[]) : (["relevant", "practice", "remember", "level"] as FixId[])),
  ];
  const picked: FixId[] = [];
  for (const id of order) {
    if (picked.length >= count) break;
    if (!picked.includes(id)) picked.push(id);
  }
  return picked.map((id) => ({ id, ...FIXES[id](plan) }));
}
