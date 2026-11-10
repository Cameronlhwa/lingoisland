// Paywall copy for the personalized flow: the headline names the learner's
// pain, the benefits answer the struggles they named, and the review is the
// one closest to them. Same copy on mobile and desktop.

import { isBeginnerPath, type OnboardingAnswers } from "./flow";
import type { UsingPainKey } from "./painPoints";
import type { LearningPlan } from "./plan";
import { planAnswers } from "./reflection";
import { matchReviews } from "./socialProof";

const PAIN_HEADLINES: Partial<Record<UsingPainKey, string>> = {
  stay_quiet: "Stop sitting out of Mandarin conversations",
  rely_on_translator: "Stop needing someone to translate for you",
  cant_keep_going: "Go past hello in your next Mandarin conversation",
  missing_opportunities: "Stop missing chances because of Mandarin",
  understand_cant_reply: "Finally reply to your family in Mandarin",
  family_switches: "Finally reply to your family in Mandarin",
  limited_with_elders: "Finally talk with your family in Mandarin",
  lost_in_class: "Keep up in class instead of getting lost",
  point_and_gesture: "Talk your way through your trip, not point",
  cant_talk_locals: "Actually talk with locals on your trip",
};

export function paywallHeadline(answers: OnboardingAnswers, plan: LearningPlan): string {
  for (const key of answers.usingPain.keys) {
    let headline = PAIN_HEADLINES[key];
    if (headline && key === "stay_quiet" && answers.goal.primary === "work") headline = `${headline} at work`;
    if (headline) return headline;
  }
  return isBeginnerPath(answers)
    ? `Your first real Mandarin conversation, in ${plan.minutesPerDay} minutes a day`
    : "Finally use the Mandarin you\u2019ve studied";
}

export function paywallSubline(plan: LearningPlan): string {
  const days = plan.daysVary ? "a few days a week" : plan.daysLabel === "every day" ? "every day" : `${plan.daysLabel} a week`;
  const focus = plan.interestPhrase ? ` Built around ${plan.interestPhrase}.` : "";
  return `${plan.minutesPerDay} minutes a day, ${days}.${focus}`;
}

export function paywallBenefits(answers: OnboardingAnswers, plan: LearningPlan): string[] {
  return planAnswers(answers, plan, 3);
}

export function paywallReview(answers: OnboardingAnswers): { quote: string; role: string } | null {
  const top = matchReviews(answers, 1)[0];
  return top ? { quote: top.testimonial.quote, role: top.testimonial.role } : null;
}
