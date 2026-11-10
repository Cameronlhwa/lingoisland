// After checkout: apply the committed plan and open the first Journey exactly
// once. Generating a Journey is slow and costs a model call, so a Journey that
// already exists for this plan (from another tab, a reload mid-generation, or
// a retry after the last step failed) is reused instead of generated again.

export type ActivateResponse = { ok: boolean; status: number; data: Record<string, unknown> | null };

export type GenerateResult = { journeyId: string } | { failed: true };

export type ActivationDeps = {
  start: () => Promise<ActivateResponse>;
  /** Throws when the request never got an answer (the server may still be generating). */
  generate: (journey: unknown) => Promise<GenerateResult>;
  complete: (journeyId: string) => Promise<boolean>;
  generationStartedAt: () => number | null;
  markGenerationStarted: () => void;
  clearGenerationStarted: () => void;
  onGenerating: () => void;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};

export type ActivationOutcome = "activated" | "already_activated" | "not_committed";

/** How long a reload or second tab waits for a generation already under way. */
export const GENERATION_WAIT_MS = 90_000;
export const GENERATION_POLL_MS = 4_000;

function generatedJourneyId(response: ActivateResponse) {
  return response.data?.status === "generated" && typeof response.data.journeyId === "string" ? response.data.journeyId : null;
}

export async function runActivation(deps: ActivationDeps): Promise<ActivationOutcome> {
  let start = await deps.start();
  if (start.data?.status === "already_activated") return "already_activated";
  if (start.status === 409) return "not_committed";
  if (!start.ok) throw new Error("start_failed");

  const startedAt = deps.generationStartedAt();
  const waiting = () => startedAt !== null && deps.now() - startedAt < GENERATION_WAIT_MS;
  if (!generatedJourneyId(start) && waiting()) {
    deps.onGenerating();
    while (!generatedJourneyId(start) && waiting()) {
      await deps.sleep(GENERATION_POLL_MS);
      start = await deps.start();
      if (start.data?.status === "already_activated") return "already_activated";
      if (start.status === 409) return "not_committed";
      if (!start.ok) throw new Error("start_failed");
    }
  }

  let journeyId = generatedJourneyId(start);
  if (!journeyId) {
    if (!start.data?.journey) throw new Error("start_failed");
    deps.onGenerating();
    deps.markGenerationStarted();
    // A thrown error keeps the marker: the server may still finish, and the retry waits for it.
    const result = await deps.generate(start.data.journey);
    if ("failed" in result) {
      deps.clearGenerationStarted();
      throw new Error("generate_failed");
    }
    journeyId = result.journeyId;
  }

  if (!(await deps.complete(journeyId))) throw new Error("complete_failed");
  deps.clearGenerationStarted();
  return "activated";
}
