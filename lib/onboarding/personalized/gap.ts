// The gap, in a few words each: where they are today, what has been missing,
// and where they'll be. Drives the diagram on "Here's what's holding you back"
// and the small bar on the paywall. Short on purpose: readable at a glance.

import type { OnboardingAnswers } from "./flow";
import type { InsightAnswer } from "./insightTypes";
import type { UsingPainKey } from "./painPoints";
import type { Roadmap } from "./roadmap";

export type Gap = { fromLabel: string; from: string; missing: string; toLabel: string; to: string };

const NOW_SHORT: Record<UsingPainKey, (work: boolean) => string> = {
  stay_quiet: (work) => (work ? "Quiet when colleagues speak Mandarin" : "Quiet when friends speak Mandarin"),
  rely_on_translator: () => "Someone translates for you",
  cant_keep_going: () => "Stuck after hello",
  missing_opportunities: () => "Missing chances at work",
  lost_in_class: () => "Lost in class",
  hard_to_connect: () => "Hard to connect with classmates",
  exam_pressure: () => "An exam coming up",
  understand_cant_reply: () => "You understand, but can\u2019t reply",
  family_switches: () => "Family switches to English for you",
  limited_with_elders: () => "Can\u2019t really talk with grandparents",
  feel_disconnected: () => "Disconnected from your roots",
  point_and_gesture: () => "Pointing and using English",
  cant_talk_locals: () => "Can\u2019t talk with locals",
  worried_get_around: () => "Worried about getting around",
  cant_follow_shows: () => "Need subtitles for everything",
  something_else: () => "",
  want_to_improve: () => "Doing fine, but want more",
};

export function shortNow(answers: OnboardingAnswers): string {
  const work = answers.goal.primary === "work";
  for (const key of answers.usingPain.keys) {
    if (key === "something_else") {
      if (answers.usingPain.customText) return answers.usingPain.customText;
      continue;
    }
    return NOW_SHORT[key](work);
  }
  return "Not using Mandarin yet";
}

/** "What's been missing is speaking practice built around your family." -> "Speaking practice built around your family" */
export function shortMissing(insight: Pick<InsightAnswer, "missing">): string {
  const match = insight.missing.match(/what[\u2019']s been missing is\s+(.+?)\.?$/i);
  const text = (match ? match[1] : insight.missing).trim().replace(/\.$/, "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildGap(answers: OnboardingAnswers, insight: Pick<InsightAnswer, "missing">, roadmap: Roadmap): Gap {
  return {
    fromLabel: "Today",
    from: shortNow(answers),
    missing: shortMissing(insight),
    toLabel: `By week ${roadmap.finalWeek}`,
    to: roadmap.finalTitle,
  };
}
