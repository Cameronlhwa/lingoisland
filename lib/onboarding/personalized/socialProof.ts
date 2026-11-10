// Reviews shown after the pain questions. They are real website reviews,
// ordered so the ones closest to the learner's pain, goal, interests, and
// level come first. Never edit a quote to make it match.

import { LEARNER_TESTIMONIALS, type LearnerTestimonial } from "../../landing-content";
import { getInterest, type GoalKey } from "./goals";
import { claimedLevel, isBeginnerPath, type OnboardingAnswers } from "./flow";

export const SITE_RATING = 4.7;
export const RATING_NOTE = "Based on reviews from LingoIsland learners on our website.";

export type MatchedReview = {
  testimonial: LearnerTestimonial;
  /** Why this review was picked, shown on the card. Null when nothing matched. */
  reason: string | null;
  score: number;
};

const LEARNING_PAIN_POINTS = 6;
const USING_PAIN_POINTS = 5;
const GOAL_POINTS = 4;
const SECONDARY_GOAL_POINTS = 1;
const INTEREST_POINTS = 2;
const LEVEL_POINTS = 1;

/** Short enough to fit on one line of a narrow review card. */
/** First match wins, so the most specific shared struggle is named. */
const PAIN_REASONS: readonly { keys: readonly string[]; reason: string }[] = [
  { keys: ["plateau"], reason: "Also felt stuck" },
  { keys: ["inconsistent", "no_time"], reason: "Also short on time" },
  { keys: ["not_relevant", "apps_felt_like_games"], reason: "Also wanted relevant lessons" },
  { keys: ["cant_keep_going", "missing_opportunities"], reason: "Also struggled with clients" },
  { keys: ["understand_cant_reply", "family_switches", "limited_with_elders"], reason: "Also grew up hearing Mandarin" },
  { keys: ["point_and_gesture", "cant_talk_locals", "worried_get_around"], reason: "Also wanted to talk with locals" },
];

const GOAL_REASON: Record<Exclude<GoalKey, "other">, string> = {
  work: "work",
  school: "school",
  heritage: "family",
  travel: "travel",
  everyday: "everyday life",
};

export function matchReviews(
  answers: OnboardingAnswers,
  count = 3,
  testimonials: readonly LearnerTestimonial[] = LEARNER_TESTIMONIALS,
): MatchedReview[] {
  const goal = answers.goal.primary;
  const secondary = answers.goal.secondary;
  const level = claimedLevel(answers);
  const learningPains: string[] = isBeginnerPath(answers) ? answers.learningPain.hesitations : answers.learningPain.keys;
  const usingPains: string[] = answers.usingPain.keys;

  const scored = testimonials.map((testimonial, index) => {
    const match = testimonial.match ?? {};
    let score = 0;
    const sharedLearning = learningPains.filter((key) => match.learningPains?.includes(key));
    const sharedUsing = usingPains.filter((key) => match.pains?.includes(key));
    if (sharedLearning.length) score += LEARNING_PAIN_POINTS;
    if (sharedUsing.length) score += USING_PAIN_POINTS;
    const shared = [...sharedLearning, ...sharedUsing];
    let reason: string | null = PAIN_REASONS.find((entry) => entry.keys.some((key) => shared.includes(key)))?.reason ?? null;
    if (goal && goal !== "other" && match.goals?.includes(goal)) {
      score += GOAL_POINTS;
      reason ??= `Also learning for ${GOAL_REASON[goal]}`;
    }
    if (secondary && secondary !== "other" && match.goals?.includes(secondary)) score += SECONDARY_GOAL_POINTS;
    const sharedInterests = answers.interests.keys.filter((key) => match.interests?.includes(key));
    score += sharedInterests.length * INTEREST_POINTS;
    if (!reason && sharedInterests.length) {
      const label = getInterest(sharedInterests[0])?.label;
      if (label) reason = `Also interested in ${label.toLowerCase()}`;
    }
    if (match.levels?.includes(level)) score += LEVEL_POINTS;
    return { testimonial, reason, score, index };
  });

  return scored
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, count)
    .map(({ testimonial, reason, score }) => ({ testimonial, reason, score }));
}

/** Headline that names the learner's group when the goal is a clear one. */
export function socialProofTitle(goal: GoalKey | null): string {
  switch (goal) {
    case "work":
      return "Professionals like you learn with LingoIsland";
    case "travel":
      return "Travelers like you learn with LingoIsland";
    case "heritage":
      return "Heritage learners like you learn with LingoIsland";
    default:
      return "Learners like you learn with LingoIsland";
  }
}

/** Headline for the reviews step: names the shared struggle when there is one. */
export function reviewsTitle(answers: OnboardingAnswers): string {
  if (isBeginnerPath(answers)) return "Others who started from zero";
  if (answers.learningPain.keys.includes("plateau")) return "People who felt stuck too";
  return socialProofTitle(answers.goal.primary);
}
