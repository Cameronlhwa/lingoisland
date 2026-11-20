import { initialState, stepsFor, type OnboardingState } from "@/lib/onboarding/personalized/flow";
import { DEFAULT_INTERESTS_BY_GOAL, type GoalKey } from "@/lib/onboarding/personalized/goals";
import { levelForSelfReport, type SelfReportKey } from "@/lib/onboarding/personalized/levels";

export const MINI_COURSE_PREVIEWS: readonly { level: SelfReportKey; title: string; concepts: string }[] = [
 { level: "new", title: "Greet people", concepts: "你好 · 大家好 · personalized greetings" },
 { level: "few_words", title: "Say what you can do", concepts: "会 · 不会 · 吗" },
 { level: "simple_sentences", title: "Say what’s possible", concepts: "能 · 不能 · familiar 吗 questions" },
 { level: "basic_conversations", title: "Make choices", concepts: "还是 · 或者" },
 { level: "familiar_topics", title: "Connect your ideas", concepts: "除了…以外，还…" },
 { level: "complex_topics", title: "Discuss different views", concepts: "一方面…另一方面…" },
];

/** A fresh, local-only test profile. Normal onboarding never calls this shortcut. */
export function miniCoursePreview(level: SelfReportKey, goal: GoalKey, now = new Date()): OnboardingState {
 const state = initialState(now, "test"), a = state.answers;
 a.goal.primary = goal;
 a.interests.keys = [...DEFAULT_INTERESTS_BY_GOAL[goal]];
 a.level.selfReport = level;
 a.estimatedLevel = levelForSelfReport(level);
 a.experience.key = level === "new" ? "not_started" : "under_6_months";
 // The lesson's own familiarity check remains available; no words are assumed known.
 a.vocabBasic = { shownIds: ["wo", "ni"], selectedIds: [], noneKnown: true };
 a.vocabAdvanced = { shownIds: [], selectedIds: [], noneKnown: false, skipped: true };
 a.usingPain = { keys: ["want_to_improve"], timing: "ongoing", upcomingText: null };
 a.learningPain = { keys: ["not_relevant"], hesitations: ["dont_know_where_start"] };
 a.availability = { minutes: "10", days: "5", session: null };
 for (const step of stepsFor(a)) {
  if (step === "first_lesson") break;
  state.events[step] = { completed_at: state.updatedAt };
 }
 return state;
}
