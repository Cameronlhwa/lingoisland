// Reviews shown before calibration. They are real website reviews, ordered so
// the ones closest to the learner's goal, interests, and level come first.

import { LEARNER_TESTIMONIALS, type LearnerTestimonial } from "../../landing-content";
import { getInterest, type GoalKey } from "./goals";
import { claimedLevel, type OnboardingAnswers } from "./flow";

export const SITE_RATING = 4.7;
export const RATING_NOTE = "Based on reviews from LingoIsland learners on our website.";

export type MatchedReview = {
  testimonial: LearnerTestimonial;
  /** Why this review was picked, shown on the card. Null when nothing matched. */
  reason: string | null;
  score: number;
};

const GOAL_POINTS = 4;
const SECONDARY_GOAL_POINTS = 1;
const INTEREST_POINTS = 2;
const LEVEL_POINTS = 1;

/** Short enough to fit on one line of a narrow review card. */
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

  const scored = testimonials.map((testimonial, index) => {
    const match = testimonial.match ?? {};
    let score = 0;
    let reason: string | null = null;
    if (goal && goal !== "other" && match.goals?.includes(goal)) {
      score += GOAL_POINTS;
      reason = `Also learning for ${GOAL_REASON[goal]}`;
    }
    if (secondary && secondary !== "other" && match.goals?.includes(secondary)) score += SECONDARY_GOAL_POINTS;
    const shared = answers.interests.keys.filter((key) => match.interests?.includes(key));
    score += shared.length * INTEREST_POINTS;
    if (!reason && shared.length) {
      const label = getInterest(shared[0])?.label;
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
