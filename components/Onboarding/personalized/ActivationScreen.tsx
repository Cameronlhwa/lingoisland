"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAnalytics } from "@/lib/posthog/client";
import { ONBOARDING_EVENTS, trackOnboarding } from "@/lib/onboarding/personalized/analytics";
import { runActivation } from "@/lib/onboarding/personalized/activation";
import {
  browserTimeZone,
  clearActivationPending,
  clearGenerationStarted,
  clearLocalState,
  generationStartedAt,
  markGenerationStarted,
  readLocalState,
} from "@/lib/onboarding/personalized/storage";
import { FieldError, FONT_DISPLAY, MUTED, NAVY, PrimaryButton, Shell, usePrefersReducedMotion } from "./ui";

type Phase = "working" | "error" | "not_committed";

async function postActivate(body: Record<string, unknown>) {
  const response = await fetch("/api/onboarding/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, timezone: browserTimeZone() }),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  return { ok: response.ok, status: response.status, data };
}

/**
 * Runs after checkout (or "Not now" in the app): applies the saved plan,
 * generates the first Journey once, then opens it.
 */
export default function ActivationScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { captureEvent } = useAnalytics();
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>("working");
  const [message, setMessage] = useState("Setting up your first Journey…");
  const runningRef = useRef(false);
  const purchaseTrackedRef = useRef(false);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setPhase("working");
    setMessage("Setting up your first Journey…");
    try {
      if (searchParams.get("purchased") === "1" && !purchaseTrackedRef.current) {
        purchaseTrackedRef.current = true;
        trackOnboarding(captureEvent, ONBOARDING_EVENTS.purchaseCompleted);
      }
      const local = readLocalState();
      const outcome = await runActivation({
        start: () => postActivate({ stage: "start", state: local ?? undefined }),
        generate: async (journey) => {
          const generate = await fetch("/api/journey/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(journey),
          });
          const generated = (await generate.json().catch(() => null)) as { journeyId?: string } | null;
          return generate.ok && generated?.journeyId ? { journeyId: generated.journeyId } : { failed: true };
        },
        complete: async (journeyId) => (await postActivate({ stage: "complete", journeyId })).ok,
        generationStartedAt,
        markGenerationStarted: () => markGenerationStarted(),
        clearGenerationStarted,
        onGenerating: () => setMessage("Building your first Journey. This can take up to a minute…"),
        now: () => Date.now(),
        sleep: (ms) => new Promise((resolve) => window.setTimeout(resolve, ms)),
      });
      if (outcome === "not_committed") {
        setPhase("not_committed");
        return;
      }

      clearLocalState();
      clearActivationPending();
      router.replace("/app/journey");
    } catch {
      setPhase("error");
    } finally {
      runningRef.current = false;
    }
  }, [captureEvent, router, searchParams]);

  // Once per visit: later runs come only from "Try again", never from run changing identity.
  const autoRunRef = useRef(false);
  useEffect(() => {
    if (autoRunRef.current) return;
    autoRunRef.current = true;
    void run();
  }, [run]);

  return (
    <Shell>
      <div className="flex flex-col items-center py-6 text-center" aria-live="polite" aria-busy={phase === "working"}>
        {phase === "working" ? (
          <>
            <span
              aria-hidden
              className={`h-10 w-10 rounded-full border-4 border-[#C2DCF0] border-t-[#20674F] ${reduced ? "" : "motion-safe:animate-spin"}`}
            />
            <h1 className="mt-5 text-[22px] font-bold" style={{ fontFamily: FONT_DISPLAY, color: NAVY }}>
              Activating your plan
            </h1>
            <p className="mt-2 text-[15px]" style={{ color: MUTED }} role="status">
              {message}
            </p>
          </>
        ) : phase === "not_committed" ? (
          <>
            <h1 className="text-[22px] font-bold" style={{ fontFamily: FONT_DISPLAY, color: NAVY }}>
              Let’s finish your plan first
            </h1>
            <p className="mt-2 text-[15px]" style={{ color: MUTED }}>
              We couldn’t find a finished plan for this account. It only takes a couple of minutes.
            </p>
            <PrimaryButton className="mt-6" onClick={() => router.replace("/app/onboarding")}>
              Continue my plan
            </PrimaryButton>
          </>
        ) : (
          <>
            <h1 className="text-[22px] font-bold" style={{ fontFamily: FONT_DISPLAY, color: NAVY }}>
              We hit a snag
            </h1>
            <FieldError message="We couldn’t set up your first Journey just now. Your plan is saved." />
            <PrimaryButton className="mt-6" onClick={() => void run()} data-testid="activation-retry">
              Try again
            </PrimaryButton>
          </>
        )}
      </div>
    </Shell>
  );
}
