import type { OnboardingEventName } from "@/lib/onboarding/personalized/analytics";
import type { OnboardingAnswers, OnboardingState, StepId } from "@/lib/onboarding/personalized/flow";

export type StepProps = {
  state: OnboardingState;
  update: (patch: Partial<OnboardingAnswers>) => void;
  /** Marks the current step complete and moves on. */
  next: (patch?: Partial<OnboardingAnswers>) => void;
  back: (() => void) | null;
  progress: { index: number; total: number };
  track: (event: OnboardingEventName, properties?: Record<string, unknown>) => void;
  announce: (message: string) => void;
  /** Jumps back to an earlier step the learner can already visit. */
  jumpTo?: (step: StepId) => void;
};
