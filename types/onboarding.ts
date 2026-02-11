/**
 * Progressive onboarding nudge steps (first-time experience only).
 * Home nudges: capybara/flashcards → quiz → story → customize settings.
 * Topic island path: visit_home nudge on island page → then home nudges.
 */
export type OnboardingStepKey =
  | "visit_home"
  | "try_flashcards"
  | "try_quiz"
  | "try_story"
  | "customize_settings";

/** Milestone keys stored in steps_completed for prereq checks */
export type OnboardingMilestoneKey = "read_first_story" | "completed_first_quiz";

export type OnboardingCompletionKey = OnboardingStepKey | OnboardingMilestoneKey;

export type EntrySource = "topic_island" | "story" | "unknown";

export interface UserOnboardingRow {
  user_id: string;
  onboarding_started_at: string | null;
  onboarding_ends_at: string | null;
  onboarding_disabled: boolean;
  steps_completed: string[];
  steps_dismissed: string[];
  last_nudge_shown_at: string | null;
  entry_source: EntrySource | null;
  updated_at: string;
}

export interface OnboardingNudge {
  key: OnboardingStepKey;
  title: string;
  body: string;
  cta: string;
  ctaHref: string;
}
