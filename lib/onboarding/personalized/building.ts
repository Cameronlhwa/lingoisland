// Timing for the plan-building screen: about 3.4 seconds by design, longer
// only while a real server step is still running.

export const BUILD_STAGES = [
  "Personalizing your vocabulary",
  "Adjusting your Mandarin level",
  "Building your learning plan",
] as const;

/** The last stage lingers this much longer than the others. */
export const LAST_STAGE_EXTRA_MS = 1000;
export const BUILD_MIN_MS = 3400;
export const BUILD_MIN_MS_REDUCED = 2500;

export function buildMinimum(reducedMotion: boolean) {
  return reducedMotion ? BUILD_MIN_MS_REDUCED : BUILD_MIN_MS;
}

export type BuildingState = {
  completedStages: number;
  done: boolean;
  /** Past the designed duration and still waiting on the server. */
  waitingOnServer: boolean;
};

export function buildingState(elapsedMs: number, serverDone: boolean, reducedMotion = false): BuildingState {
  const minimum = buildMinimum(reducedMotion);
  const perStage = (minimum - LAST_STAGE_EXTRA_MS) / BUILD_STAGES.length;
  let completed =
    elapsedMs >= minimum
      ? BUILD_STAGES.length
      : Math.min(BUILD_STAGES.length - 1, Math.floor(Math.max(0, elapsedMs) / perStage));
  // The last check only appears once the plan really exists.
  if (!serverDone) completed = Math.min(completed, BUILD_STAGES.length - 1);
  const done = serverDone && elapsedMs >= minimum;
  return { completedStages: completed, done, waitingOnServer: !serverDone && elapsedMs >= minimum };
}
