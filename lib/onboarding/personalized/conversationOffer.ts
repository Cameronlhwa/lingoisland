import { isBeginnerPath, type OnboardingAnswers } from "./flow";
import { effectiveInterestKeys, normalizeCustomText, type GoalKey } from "./goals";
import type { HesitationKey, LearningPainKey, UsingPainKey } from "./painPoints";
import { PATH_WEEKS, type LearningPlan } from "./plan";
import { destinationFor, momentFor } from "./progress";

const HEADLINES: Record<GoalKey, string> = {
  work: "Mandarin that fits your workday.",
  school: "Mandarin that fits your studies.",
  heritage: "Mandarin that fits your family.",
  travel: "Mandarin that fits your trip.",
  everyday: "Mandarin that fits your day.",
  other: "Mandarin that fits your goals.",
};

/** Pain → hopeful fix, personalized by goal when it matters. */
const PAIN_HOPE: Partial<Record<UsingPainKey, (goal: GoalKey) => string>> = {
  stay_quiet: (goal) =>
    goal === "work"
      ? "Go from sitting quiet to joining Mandarin conversations at work"
      : "Go from sitting quiet to joining the conversation",
  rely_on_translator: () => "Handle Mandarin moments yourself, without waiting for a translator",
  cant_keep_going: () => "Keep conversations going past hello, with words that fit you",
  missing_opportunities: () => "Show up ready when Mandarin opens a door at work",
  lost_in_class: () => "Keep up in class instead of getting lost mid-lesson",
  hard_to_connect: () => "Connect with classmates in Mandarin, not only in English",
  exam_pressure: () => "Walk into your exam feeling prepared, not panicked",
  understand_cant_reply: () => "Understand and answer, so family chats stay in Mandarin",
  family_switches: () => "Reply in Mandarin so your family does not have to switch",
  limited_with_elders: () => "Talk with grandparents in your own words",
  feel_disconnected: () => "Feel closer to your roots through real conversations",
  point_and_gesture: () => "Ask for what you need in Mandarin, not by pointing",
  cant_talk_locals: () => "Have real chats with locals, not just hellos",
  worried_get_around: () => "Get around on your own with Mandarin you can use",
  cant_follow_shows: () => "Follow more without leaning on subtitles",
};

const STRUGGLE_HOPE: Partial<Record<LearningPainKey | HesitationKey, (plan: LearningPlan) => string>> = {
  forget_words: () => "Reviews timed so the words you need actually stick",
  not_relevant: (plan) =>
    plan.interestPhrase
      ? `Only Mandarin for ${plan.interestPhrase}, not random textbook lines`
      : "Only Mandarin you will actually use",
  freeze_speaking: () => "Practice speaking safely before the real moment",
  plateau: () => "Lessons that push past where you are stuck",
  inconsistent: (plan) => `Make steady progress in ${plan.minutesPerDay} minutes a day`,
  no_practice: () => "Rehearse real conversations before you need them",
  tones: () => "Hear what is off and fix it, instead of guessing",
  no_time: (plan) => `Real progress that fits ${plan.minutesPerDay} minutes a day`,
  seems_too_hard: () => "Start simple, then feel yourself getting better week by week",
  dont_know_where_start: () => "Open the app and your next step is already ready",
  apps_felt_like_games: () => "Lessons for real life, not another game streak",
  worried_quit: (plan) => `A plan built for ${plan.minutesPerDay}-minute days, so you keep going`,
};

function headlineFor(answers: OnboardingAnswers, goal: GoalKey): string {
  const keys = effectiveInterestKeys(answers.goal.primary, answers.interests.keys);
  if (keys.includes("hsk_certification")) return "Mandarin that fits your HSK goal.";
  if (goal === "other") {
    const other = normalizeCustomText(answers.goal.otherText);
    if (other) return `Mandarin that fits ${other}.`;
  }
  return HEADLINES[goal];
}

function hopeFromPain(answers: OnboardingAnswers, goal: GoalKey): string | null {
  for (const key of answers.usingPain.keys) {
    const line = PAIN_HOPE[key]?.(goal);
    if (line) return line;
  }
  if (answers.usingPain.keys.includes("something_else")) {
    const custom = normalizeCustomText(answers.usingPain.customText);
    if (custom) return `A clear path past this: ${custom}`;
  }
  return null;
}

function hopeFromStruggle(answers: OnboardingAnswers, plan: LearningPlan): string | null {
  const beginner = isBeginnerPath(answers);
  const struggles: (LearningPainKey | HesitationKey)[] = beginner
    ? answers.learningPain.hesitations
    : answers.learningPain.keys;
  for (const key of struggles) {
    const line = STRUGGLE_HOPE[key]?.(plan);
    if (line) return line;
  }
  return null;
}

function hopeFromSituation(answers: OnboardingAnswers, plan: LearningPlan): string {
  const custom = normalizeCustomText(answers.interests.custom);
  if (custom) return `Build Mandarin for ${custom} you can use soon`;
  const moment = momentFor(answers, "");
  if (moment) return `Get ready to ${moment}`;
  return `Get ready for ${destinationFor(answers)} · about ${plan.milestone.range}`;
}

/** Two personalized, hopeful lines: fix their problem, then show how good they can get. */
function benefitLines(answers: OnboardingAnswers, plan: LearningPlan, goal: GoalKey): { title: string; detail: string }[] {
  const first = hopeFromPain(answers, goal) ?? hopeFromSituation(answers, plan);
  const second =
    hopeFromStruggle(answers, plan) ??
    (isBeginnerPath(answers)
      ? `From where you are now to ${destinationFor(answers)}, in about ${plan.milestone.range}`
      : `On track for ${plan.milestone.text} in about ${plan.milestone.range}`);

  const lines = [first, second].filter((line, index, all) => all.indexOf(line) === index);
  if (lines.length < 2) {
    lines.push(`Built around ${plan.interestPhrase || "the situations you care about"}`);
  }
  return lines.slice(0, 2).map((title) => ({ title, detail: "" }));
}

function sublineFor(answers: OnboardingAnswers, plan: LearningPlan): string {
  const destination = destinationFor(answers);
  const minutes = plan.minutesPerDay;
  const customGoal = answers.goal.primary === "other" ? normalizeCustomText(answers.goal.otherText) : null;
  if (customGoal) return `${minutes} minutes a day toward ${customGoal}.`;
  return `${minutes} minutes a day toward ${destination}.`;
}

/** Uses the same saved answers and plan as lesson generation, never an independent profile. */
export function conversationOffer(answers: OnboardingAnswers, plan: LearningPlan) {
  const goal = answers.goal.primary ?? "other";
  const destination = destinationFor(answers);

  return {
    presentation: "conversation" as const,
    headline: headlineFor(answers, goal),
    subline: sublineFor(answers, plan),
    comparison: {
      title: `Your progress toward ${destination}`,
      weeks: PATH_WEEKS,
      lingoLabel: "LingoIsland",
      otherLabel: "Typical apps",
    },
    benefits: benefitLines(answers, plan, goal),
    cta: "Start my plan",
  };
}
