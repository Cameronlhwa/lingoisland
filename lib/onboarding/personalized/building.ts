// Timing for the plan-building screen: about 2.5 seconds by design, longer
// only while a real server step is still running.

export const BUILD_STAGES = [
  "Personalizing your vocabulary",
  "Adjusting your Mandarin level",
  "Building your learning plan",
] as const;

export const BUILD_MIN_MS = 2400;
export const BUILD_MIN_MS_REDUCED = 1500;

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
  const perStage = minimum / BUILD_STAGES.length;
  let completed = Math.min(BUILD_STAGES.length, Math.floor(Math.max(0, elapsedMs) / perStage));
  // The last check only appears once the plan really exists.
  if (!serverDone) completed = Math.min(completed, BUILD_STAGES.length - 1);
  const done = serverDone && elapsedMs >= minimum;
  return { completedStages: completed, done, waitingOnServer: !serverDone && elapsedMs >= minimum };
}
