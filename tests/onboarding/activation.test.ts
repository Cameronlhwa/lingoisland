import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GENERATION_POLL_MS,
  GENERATION_WAIT_MS,
  runActivation,
  type ActivateResponse,
  type ActivationDeps,
  type GenerateResult,
} from "../../lib/onboarding/personalized/activation";

const READY: ActivateResponse = { ok: true, status: 200, data: { status: "ready", journey: { topic: "Meetings" } } };
const generated = (journeyId: string): ActivateResponse => ({ ok: true, status: 200, data: { status: "generated", journeyId } });

function harness(options: {
  starts: ActivateResponse[];
  generate?: () => Promise<GenerateResult>;
  complete?: boolean;
  markerAgeMs?: number | null;
}) {
  let clock = 1_000_000;
  let marker: number | null = options.markerAgeMs == null ? null : clock - options.markerAgeMs;
  const calls = { start: 0, generate: 0, complete: [] as string[], sleeps: 0 };
  const deps: ActivationDeps = {
    start: async () => options.starts[Math.min(calls.start++, options.starts.length - 1)],
    generate: async () => {
      calls.generate += 1;
      return options.generate ? options.generate() : { journeyId: "new-journey" };
    },
    complete: async (journeyId) => {
      calls.complete.push(journeyId);
      return options.complete ?? true;
    },
    generationStartedAt: () => marker,
    markGenerationStarted: () => {
      marker = clock;
    },
    clearGenerationStarted: () => {
      marker = null;
    },
    onGenerating: () => undefined,
    now: () => clock,
    sleep: async (ms) => {
      calls.sleeps += 1;
      clock += ms;
    },
  };
  return { deps, calls, marker: () => marker };
}

describe("activation after checkout", () => {
  it("generates the first Journey once and completes", async () => {
    const h = harness({ starts: [READY] });
    assert.equal(await runActivation(h.deps), "activated");
    assert.equal(h.calls.generate, 1);
    assert.deepEqual(h.calls.complete, ["new-journey"]);
    assert.equal(h.marker(), null);
  });

  it("reuses a Journey the server already has instead of generating another", async () => {
    const h = harness({ starts: [generated("existing")] });
    assert.equal(await runActivation(h.deps), "activated");
    assert.equal(h.calls.generate, 0);
    assert.deepEqual(h.calls.complete, ["existing"]);
  });

  it("a reload during generation waits for the Journey instead of starting a second one", async () => {
    const h = harness({ starts: [READY, READY, generated("from-first-tab")], markerAgeMs: 10_000 });
    assert.equal(await runActivation(h.deps), "activated");
    assert.equal(h.calls.generate, 0);
    assert.deepEqual(h.calls.complete, ["from-first-tab"]);
    assert.equal(h.calls.sleeps, 2);
  });

  it("generates after waiting the full window when the first attempt never produced a Journey", async () => {
    const h = harness({ starts: [READY], markerAgeMs: 0 });
    assert.equal(await runActivation(h.deps), "activated");
    assert.equal(h.calls.generate, 1);
    assert.equal(h.calls.sleeps, Math.ceil(GENERATION_WAIT_MS / GENERATION_POLL_MS));
  });

  it("an old marker from an abandoned attempt doesn't make the learner wait", async () => {
    const h = harness({ starts: [READY], markerAgeMs: GENERATION_WAIT_MS + 1 });
    await runActivation(h.deps);
    assert.equal(h.calls.sleeps, 0);
    assert.equal(h.calls.generate, 1);
  });

  it("a failed generation clears the marker so Try again generates right away", async () => {
    const h = harness({ starts: [READY], generate: async () => ({ failed: true }) });
    await assert.rejects(runActivation(h.deps), /generate_failed/);
    assert.equal(h.marker(), null);
  });

  it("a dropped connection keeps the marker, because the server may still finish", async () => {
    const h = harness({
      starts: [READY],
      generate: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    await assert.rejects(runActivation(h.deps));
    assert.notEqual(h.marker(), null);
  });

  it("Try again after the last step failed completes the same Journey without regenerating", async () => {
    const first = harness({ starts: [READY], complete: false });
    await assert.rejects(runActivation(first.deps), /complete_failed/);
    assert.equal(first.calls.generate, 1);

    const retry = harness({ starts: [generated("new-journey")] });
    assert.equal(await runActivation(retry.deps), "activated");
    assert.equal(retry.calls.generate, 0);
    assert.deepEqual(retry.calls.complete, ["new-journey"]);
  });

  it("reports an activated or uncommitted account without generating", async () => {
    const done = harness({ starts: [{ ok: true, status: 200, data: { status: "already_activated" } }] });
    assert.equal(await runActivation(done.deps), "already_activated");
    const uncommitted = harness({ starts: [{ ok: false, status: 409, data: { status: "not_committed" } }] });
    assert.equal(await runActivation(uncommitted.deps), "not_committed");
    assert.equal(done.calls.generate + uncommitted.calls.generate, 0);
  });
});
