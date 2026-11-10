// The "Did we get this right?" reflection and the plan lines that answer each
// struggle the learner named. Pure so it can be tested and reused on the
// plan step and the paywall.

import type { GoalKey } from "./goals";
import { isBeginnerPath, type OnboardingAnswers } from "./flow";
import type { ExperienceKey, HesitationKey, LearningPainKey, UsingPainKey } from "./painPoints";
import type { LearningPlan } from "./plan";

const USING_PAIN_YOU: Record<UsingPainKey, (goal: GoalKey | null) => string> = {
  stay_quiet: (goal) => (goal === "work" ? "You stay quiet when colleagues speak Mandarin." : "You stay quiet when friends speak Mandarin."),
  rely_on_translator: () => "Someone has to translate for you.",
  cant_keep_going: () => "You can say hello, but can\u2019t keep the conversation going.",
  missing_opportunities: () => "You\u2019re missing chances with clients, roles or deals.",
  lost_in_class: () => "You get lost in class or lectures.",
  hard_to_connect: () => "It\u2019s hard to connect with Chinese classmates.",
  exam_pressure: () => "You have an exam or requirement coming up.",
  understand_cant_reply: () => "You understand some Mandarin, but can\u2019t reply.",
  family_switches: () => "Your family switches to English for you.",
  limited_with_elders: () => "You can\u2019t really talk with grandparents or older relatives.",
  feel_disconnected: () => "You feel disconnected from your roots.",
  point_and_gesture: () => "You end up pointing and using English.",
  cant_talk_locals: () => "You can\u2019t really talk with locals.",
  worried_get_around: () => "You worry about getting around on your own.",
  cant_follow_shows: () => "You can\u2019t follow shows or videos without subtitles.",
  something_else: () => "",
  want_to_improve: () => "Mandarin isn\u2019t holding you back, but you want it to be stronger.",
};

const LEARNING_PAIN_YOU: Record<LearningPainKey, string> = {
  forget_words: "You forget words quickly.",
  not_relevant: "Lessons weren\u2019t about things you actually need.",
  freeze_speaking: "You recognize words but freeze when speaking.",
  plateau: "You\u2019ve stopped improving.",
  inconsistent: "You don\u2019t have enough time.",
  no_practice: "You have no one to practise with.",
  tones: "Tones and pronunciation feel tricky.",
};

const HESITATION_YOU: Record<HesitationKey, string> = {
  no_time: "You weren\u2019t sure you\u2019d have time.",
  seems_too_hard: "Mandarin seemed too hard, with tones and characters.",
  dont_know_where_start: "You didn\u2019t know where to start.",
  apps_felt_like_games: "Apps felt like games, not real Mandarin.",
  worried_quit: "You were worried you\u2019d quit.",
};

const EXPERIENCE_YOU: Partial<Record<ExperienceKey, string>> = {
  under_6_months: "You\u2019ve been learning for less than 6 months.",
  "6_to_24_months": "You\u2019ve been learning for 6 months to 2 years.",
  over_2_years: "You\u2019ve been learning for more than 2 years.",
  on_and_off: "You\u2019ve been learning on and off for years.",
  as_a_kid: "You learned some Mandarin as a kid.",
};

export type Reflection = {
  rightNow: string;
  struggleLabel: string;
  struggle: string;
  goal: string;
  beginner: boolean;
};

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Handling basic client situations, in about 10 to 15 weeks" or "…, so you're ready for a client dinner". */
export function goalLine(plan: LearningPlan, upcomingText: string | null): string {
  const milestone = capitalize(plan.milestone.text);
  return upcomingText ? `${milestone}, so you\u2019re ready for ${upcomingText}.` : `${milestone}, in about ${plan.milestone.range}.`;
}

export function reflectionFor(answers: OnboardingAnswers, plan: LearningPlan): Reflection {
  const beginner = isBeginnerPath(answers);
  const goal = answers.goal.primary;
  const custom = answers.usingPain.customText;
  const rightNow =
    answers.usingPain.keys
      .map((key) => (key === "something_else" ? (custom ? `In your words: \u201c${custom}\u201d.` : "") : USING_PAIN_YOU[key](goal)))
      .filter(Boolean)
      .join(" ") || "You want Mandarin you can actually use.";
  const struggle = beginner
    ? answers.learningPain.hesitations.map((key) => HESITATION_YOU[key]).join(" ")
    : [EXPERIENCE_YOU[answers.experience.key ?? "not_started"], ...answers.learningPain.keys.map((key) => LEARNING_PAIN_YOU[key])]
        .filter(Boolean)
        .join(" ");
  return {
    rightNow,
    struggleLabel: beginner ? "What\u2019s held you back" : "What\u2019s been hard",
    struggle: struggle || (beginner ? "You\u2019re starting fresh." : "Learning hasn\u2019t stuck the way you wanted."),
    goal: goalLine(plan, answers.usingPain.upcomingText),
    beginner,
  };
}

/** How the plan answers each struggle. Shared with the paywall's benefits. */
const ANSWERS: Record<LearningPainKey | HesitationKey, (plan: LearningPlan) => string> = {
  not_relevant: () => "Every lesson uses your situations, not textbook scenarios",
  apps_felt_like_games: () => "Every lesson uses your situations, not textbook scenarios",
  forget_words: () => "Quick reviews bring words back before you forget them",
  freeze_speaking: () => "Practice conversations before the real one",
  no_practice: () => "Practice conversations before the real one",
  inconsistent: (plan) => `${plan.minutesPerDay}-minute lessons that fit your week`,
  no_time: (plan) => `${plan.minutesPerDay}-minute lessons that fit your week`,
  plateau: () => "Starts above what you already know",
  tones: () => "Pinyin on everything and extra tone help",
  seems_too_hard: () => "Pinyin on everything and extra tone help",
  dont_know_where_start: () => "A clear first step every time you open the app",
  worried_quit: () => "Small goals so you keep going",
};

const DEFAULT_ANSWERS: readonly ((plan: LearningPlan) => string)[] = [
  (plan) => (plan.interestPhrase ? `Lessons built around ${plan.interestPhrase}` : "Lessons built around your situations"),
  () => "Practice conversations before the real one",
  () => "Quick reviews that fit your day",
];

/** Up to `count` distinct lines, the learner's own struggles first, then defaults. */
export function planAnswers(answers: OnboardingAnswers, plan: LearningPlan, count = 3): string[] {
  const keys: (LearningPainKey | HesitationKey)[] = isBeginnerPath(answers) ? answers.learningPain.hesitations : answers.learningPain.keys;
  const lines: string[] = [];
  const add = (line: string) => {
    if (lines.length < count && !lines.includes(line)) lines.push(line);
  };
  keys.forEach((key) => add(ANSWERS[key](plan)));
  DEFAULT_ANSWERS.forEach((make) => add(make(plan)));
  return lines;
}
