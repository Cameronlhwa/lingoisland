// "Your path" chart on the reflection screen (direction A1): words they know
// today rising to the end of their plan, the moment they'll reach, the
// reasons that answer their own struggles, and a flag for an event they told
// us about. Pure, so the copy can be unit tested.

import { effectiveInterestKeys, getGoal, getInterest, type GoalKey } from "./goals";
import { type OnboardingAnswers } from "./flow";
import { fixesFor, type Fix } from "./fixes";
import { shortNow } from "./gap";
import { timingHasEvent, type TimingKey } from "./painPoints";
import type { LearningPlan } from "./plan";
import type { Roadmap } from "./roadmap";

/**
 * Words known at the start and the end of the path, by internal level
 * (0 = pre-HSK ... 6). Anchored to the cumulative HSK 2.0 word lists
 * (150 / 300 / 600 / 1,200 / 2,500). PLACEHOLDER GAIN: replace `to` with the
 * real number of words in the learner's generated curriculum once that is
 * available, so the chart never promises more than the lessons teach.
 */
export const WORDS_BY_LEVEL: readonly [number, number][] = [
  [0, 300],
  [150, 450],
  [300, 600],
  [600, 900],
  [1200, 1500],
  [2400, 3000],
  [2400, 3000],
];

/** Where they'll be, in a few words, for the headline ("to client chats"). */
const DESTINATION_SHORT: Record<string, string> = {
  clients: "client chats",
  finance: "client chats",
  sales: "pitching in Mandarin",
  meetings: "joining team meetings",
  networking: "networking in Mandarin",
  technology: "tech talk at work",
  hsk_certification: "exam-ready Mandarin",
  entrepreneurship: "pitching in Mandarin",
  family_conversations: "real family chats",
  childhood: "real family chats",
  traditions: "family celebrations in Mandarin",
  restaurants: "ordering like a local",
  transportation: "getting around on your own",
  hotels: "travelling on your own",
  shopping: "shopping in Mandarin",
  sightseeing: "travelling on your own",
  meeting_locals: "chatting with locals",
  school_life: "keeping up in class",
  presentations: "presenting in Mandarin",
  friends: "chatting with friends",
};

const DESTINATION_BY_GOAL: Record<GoalKey, string> = {
  work: "client chats",
  school: "keeping up in class",
  heritage: "real family chats",
  travel: "chatting with locals",
  everyday: "real conversations",
  other: "real conversations",
};

/** The green bubble: the moment itself, in a sentence. */
const MOMENT: Record<string, string> = {
  clients: "chat with clients in Mandarin",
  finance: "talk numbers with clients in Mandarin",
  sales: "pitch to clients in Mandarin",
  meetings: "follow and join team meetings in Mandarin",
  networking: "network at events in Mandarin",
  technology: "talk tech with colleagues in Mandarin",
  hsk_certification: "walk into your Mandarin exam feeling ready",
  family_conversations: "talk with your family in Mandarin",
  childhood: "share stories with your family in Mandarin",
  traditions: "celebrate holidays with family in Mandarin",
  restaurants: "order anything, exactly how you want it",
  transportation: "get around the city on your own",
  hotels: "handle hotels and taxis on your own",
  shopping: "shop and bargain in Mandarin",
  sightseeing: "find your way anywhere on your own",
  meeting_locals: "have real conversations with locals",
  school_life: "keep up with classmates and class",
  presentations: "give a short presentation in Mandarin",
  friends: "make plans with friends in Mandarin",
};

export type ProgressEvent = { week: number; label: string; detail: string };


export type Progress = {
  headline: string;
  weeks: [number, number, number];
  ticks: [string, string, string, string];
  from: number;
  to: number;
  moment: string;
  event: ProgressEvent | null;
  reasons: Fix[];
};

function format(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * The topic that names their destination. It must belong to the same area as
 * their goal, because the week-by-week milestones come from the goal: a work
 * learner who also picked "shopping" gets a work destination, so the headline
 * and the milestone cards tell the same story.
 */
function firstInterest(answers: OnboardingAnswers): string | null {
  const family = getGoal(answers.goal.primary)?.family;
  const keys = effectiveInterestKeys(answers.goal.primary, answers.interests.keys);
  return keys.find((key) => !family || answers.goal.primary === "everyday" || answers.goal.primary === "other" || getInterest(key)?.family === family) ?? null;
}

/** Short destination used on the paywall chart and hope lines. */
export function destinationFor(answers: OnboardingAnswers): string {
  const interest = firstInterest(answers);
  const goal = answers.goal.primary ?? "everyday";
  return (interest && DESTINATION_SHORT[interest]) || DESTINATION_BY_GOAL[goal];
}

/** The hopeful “you’ll be able to…” moment for this learner. */
export function momentFor(answers: OnboardingAnswers, fallback: string): string {
  const interest = firstInterest(answers);
  return (interest && MOMENT[interest]) || fallback;
}

/** Ticks under the chart: thirds of the plan, ending on its last week. */
export function progressWeeks(finalWeek: number): [number, number, number] {
  const last = Math.max(3, Math.round(finalWeek));
  const first = Math.max(1, Math.round(last / 3));
  const second = Math.min(last - 1, Math.max(first + 1, Math.round((last * 2) / 3)));
  return [first, second, last];
}

/**
 * When their event falls: this week = week 1, within a month = week 4, an
 * undated trip or event = the first checkpoint. What's "ready by then" is the
 * last roadmap stage that falls on or before that week, never a later one.
 */
function eventStage(timing: TimingKey | null, weeks: [number, number, number], roadmap: Roadmap): { week: number; stage: number } {
  const week = timing === "this_week" ? 1 : timing === "this_month" ? Math.min(4, weeks[2]) : weeks[0];
  let stage = 0;
  roadmap.stages.forEach((item, index) => {
    if (item.week <= week) stage = index;
  });
  return { week, stage };
}

export function buildProgress(answers: OnboardingAnswers, plan: LearningPlan, roadmap: Roadmap): Progress {
  const [from, to] = WORDS_BY_LEVEL[Math.max(0, Math.min(6, plan.level))];
  const step = (to - from) / 3;
  const weeks = progressWeeks(roadmap.finalWeek);
  const destination = destinationFor(answers);
  const custom = answers.usingPain.keys.includes("something_else") && answers.usingPain.customText;
  const today = custom && answers.usingPain.keys.length === 1 ? "where you are today" : lowerFirst(shortNow(answers));

  const momentText = momentFor(answers, lowerFirst(roadmap.finalTitle));
  const upcoming = timingHasEvent(answers.usingPain.timing) ? answers.usingPain.upcomingText : null;
  const { week, stage } = eventStage(answers.usingPain.timing, weeks, roadmap);
  return {
    headline: `From ${today} to ${destination} in ${weeks[2]} weeks`,
    weeks,
    ticks: [format(from), format(from + step), format(from + 2 * step), format(to)],
    from,
    to,
    moment: `Week ${weeks[2]}: ${momentText}`,
    event: upcoming
      ? {
          week,
          label: `Week ${week}: ${upcoming}`,
          detail: `Ready by then: ${lowerFirst(roadmap.stages[stage]?.title ?? roadmap.stages[0]?.title ?? "your first phrases")}`,
        }
      : null,
    reasons: fixesFor(answers, plan, 3),
  };
}
