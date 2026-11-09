// Turns untrusted client state into the arguments for the onboarding RPCs.
// Pure, so the API route and the database integration tests share it.

import {
  answersForServer,
  interestRows,
  isStepId,
  parseEvents,
  parseState,
  progressColumns,
  resumeStep,
  type OnboardingState,
  type StepId,
} from "./flow";

export type ProgressRow = {
  answers?: unknown;
  step_events?: unknown;
  revision?: number;
  updated_at?: string;
  activated_at?: string | null;
  activated_journey_id?: string | null;
};

export type StoredProgress = { state: OnboardingState; activatedAt: string | null; activatedJourneyId: string | null };

export function stateFromRow(row: ProgressRow | null | undefined, timezone: string): StoredProgress | null {
  if (!row || !row.answers) return null;
  const state = parseState(
    { answers: row.answers, events: row.step_events, revision: row.revision ?? 0, updatedAt: row.updated_at },
    timezone,
  );
  if (!state) return null;
  return { state, activatedAt: row.activated_at ?? null, activatedJourneyId: row.activated_journey_id ?? null };
}

export type PreparedSave = {
  state: OnboardingState;
  step: StepId;
  saveArgs: {
    p_expected_revision: number | null;
    p_answers: ReturnType<typeof answersForServer>;
    p_step_events: OnboardingState["events"];
    p_columns: ReturnType<typeof progressColumns>;
    p_interests: ReturnType<typeof interestRows>;
  };
  /** Arguments for onboarding_record_assessment when a scored attempt exists. */
  assessmentArgs: { p_attempt_id: string; p_responses: Array<Record<string, unknown>> } | null;
};

/**
 * Re-validates the answers (parseState re-scores the placement) and computes
 * every normalized column on the server side of the trust boundary.
 */
export function prepareProgressSave(input: {
  state: unknown;
  currentStep: unknown;
  expectedRevision: unknown;
  timezone: string;
  allowSimulation: boolean;
}): PreparedSave | null {
  const raw = input.state && typeof input.state === "object" ? (input.state as Record<string, unknown>) : null;
  const state = raw ? parseState({ ...raw, revision: 0, updatedAt: new Date().toISOString() }, input.timezone) : null;
  if (!state) return null;
  state.events = parseEvents(raw?.events);
  if (!input.allowSimulation && state.answers.messaging.status === "simulated") {
    state.answers.messaging = { channel: "none", status: "unavailable" };
  }
  const step: StepId = isStepId(input.currentStep) ? input.currentStep : resumeStep(state);
  const expected =
    typeof input.expectedRevision === "number" && Number.isInteger(input.expectedRevision) && input.expectedRevision >= 0
      ? input.expectedRevision
      : null;

  const placement = state.answers.calibration.placement;
  const attemptId = state.answers.calibration.attemptId;
  const assessmentArgs =
    placement && attemptId && placement.responses.length > 0
      ? {
          p_attempt_id: attemptId,
          p_responses: placement.responses.map((response) => ({
            position: response.position,
            question_id: response.questionId,
            role: response.role,
            question_level: response.level,
            choice_id: response.choiceId,
            correct: response.correct,
            weight: response.weight,
          })),
        }
      : null;

  return {
    state,
    step,
    saveArgs: {
      p_expected_revision: expected,
      p_answers: answersForServer(state.answers),
      p_step_events: state.events,
      p_columns: progressColumns(state, step),
      p_interests: interestRows(state.answers),
    },
    assessmentArgs,
  };
}
