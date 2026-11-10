"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAnalytics } from "@/lib/posthog/client";
import { createClient } from "@/lib/supabase/browser";
import { ONBOARDING_EVENTS, trackOnboarding, type OnboardingEventName } from "@/lib/onboarding/personalized/analytics";
import {
  canVisit,
  initialState,
  isStepId,
  isStepComplete,
  lastCompletedStep,
  markAbandoned,
  markCompleted,
  markStarted,
  mergeStates,
  nextStep,
  previousStep,
  progressFor,
  provisionalLevel,
  resumeStep,
  stepsFor,
  updateAnswers,
  type OnboardingAnswers,
  type OnboardingState,
  type StepId,
} from "@/lib/onboarding/personalized/flow";
import {
  clearLocalState,
  fetchRemoteProgress,
  markActivationPending,
  readLocalState,
  resetRemoteProgress,
  saveRemoteProgress,
  sendAbandonBeacon,
  writeLocalState,
  type AccountKind,
} from "@/lib/onboarding/personalized/storage";
import { CalibrationStep } from "./CalibrationStep";
import { PaywallStep, type FlowMode } from "./PaywallStep";
import { BuildingStep, CommitmentStep, PlanStep, ReflectStep } from "./PlanSteps";
import { currentInsight, insightKey, templateInsight } from "@/lib/onboarding/personalized/insight";
import { parseInsight } from "@/lib/onboarding/personalized/insightTypes";
import { ExperienceStep, LearningPainStep, ReviewsStep, UsingPainStep } from "./PainSteps";
import { AvailabilityStep, GoalStep, InterestsStep, LevelStep } from "./ProfileSteps";
import { PronunciationStep } from "./PronunciationStep";
import type { StepProps } from "./stepTypes";
import { LiveRegion, MUTED, Shell } from "./ui";

const SAVE_DEBOUNCE_MS = 600;
const SAVE_RETRY_MIN_MS = 2_000;
const SAVE_RETRY_MAX_MS = 30_000;
const SAVE_MAX_RETRIES = 6;

type Account = { kind: AccountKind; firstName: string | null };

export default function PersonalizedOnboardingFlow({ mode }: { mode: FlowMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { captureEvent } = useAnalytics();

  const [state, setState] = useState<OnboardingState | null>(null);
  const [step, setStep] = useState<StepId>("goal");
  const [account, setAccount] = useState<Account>({ kind: "guest", firstName: null });
  const [announcement, setAnnouncement] = useState("");

  const stateRef = useRef<OnboardingState | null>(null);
  const stepRef = useRef<StepId>("goal");
  const accountRef = useRef<Account>(account);
  const saveTimerRef = useRef<number | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const retryCountRef = useRef(0);
  const unmountedRef = useRef(false);
  const recordedAttemptsRef = useRef<Set<string>>(new Set());
  const initRef = useRef(false);

  accountRef.current = account;

  const track = useCallback(
    (event: OnboardingEventName, properties?: Record<string, unknown>) => trackOnboarding(captureEvent, event, properties),
    [captureEvent],
  );

  const commit = useCallback((next: OnboardingState) => {
    stateRef.current = next;
    setState(next);
    writeLocalState(next);
  }, []);

  // ---------------------------------------------------------------------------
  // Server sync: debounced, one request at a time, merges on revision conflicts.
  // ---------------------------------------------------------------------------

  /** Resolves false when the server could not be reached or failed, so the caller retries. */
  const saveOnce = useCallback(async (): Promise<boolean> => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const current = stateRef.current;
      if (!current) return true;
      const attemptId = current.answers.calibration.attemptId;
      const recordAssessment = Boolean(current.answers.calibration.placement && attemptId && !recordedAttemptsRef.current.has(attemptId));
      const outcome = await saveRemoteProgress(current, stepRef.current, { recordAssessment });
      const latest = stateRef.current ?? current;
      if (outcome.status === "saved") {
        if (recordAssessment && attemptId) recordedAttemptsRef.current.add(attemptId);
        commit({ ...latest, revision: outcome.state.revision });
        return true;
      }
      if (outcome.status === "error") return false;
      if (!outcome.state) return true;
      const merged = mergeStates(latest, outcome.state);
      if (!merged) return true;
      commit(merged);
    }
    return true;
  }, [commit]);

  /** Saves the latest state now. Calls are queued so each caller awaits a save that includes its changes. */
  const saveNow = useCallback(
    (force = false): Promise<void> => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      if (!force && accountRef.current.kind === "guest") return Promise.resolve();
      const task = queueRef.current.then(saveOnce).then((saved) => {
        if (saved) {
          retryCountRef.current = 0;
          return;
        }
        // Answers stay in local storage meanwhile, and every save sends the whole
        // state, so the next change also catches up after retries stop.
        if (saveTimerRef.current || unmountedRef.current || retryCountRef.current >= SAVE_MAX_RETRIES) return;
        const delay = Math.min(SAVE_RETRY_MIN_MS * 2 ** retryCountRef.current, SAVE_RETRY_MAX_MS);
        retryCountRef.current += 1;
        saveTimerRef.current = window.setTimeout(() => void saveNowRef.current(force), delay);
      });
      queueRef.current = task.catch(() => undefined);
      return task.catch(() => undefined);
    },
    [saveOnce],
  );
  const saveNowRef = useRef(saveNow);
  saveNowRef.current = saveNow;

  const scheduleSave = useCallback(() => {
    if (accountRef.current.kind === "guest") return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => void saveNow(), SAVE_DEBOUNCE_MS);
  }, [saveNow]);

  const apply = useCallback(
    (next: OnboardingState) => {
      commit(next);
      scheduleSave();
    },
    [commit, scheduleSave],
  );

  // ---------------------------------------------------------------------------
  // Load and resume
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    void (async () => {
      const restarting = searchParams.get("restart") === "1";
      if (restarting) {
        clearLocalState();
        await resetRemoteProgress().catch(() => ({ status: "error" as const }));
        router.replace("/onboarding/journey");
      }
      const local = restarting ? null : readLocalState();
      const remote = await fetchRemoteProgress().catch(() => null);
      const nextAccount: Account = remote?.account ?? { kind: "guest", firstName: null };
      if (remote?.activatedAt) {
        router.replace("/app");
        return;
      }
      const merged = mergeStates(local, remote?.state ?? null) ?? initialState(new Date());
      const requested = searchParams.get("resume");
      const resume = isStepId(requested) && canVisit(requested, merged) ? requested : resumeStep(merged);
      const fresh = Object.keys(merged.events).length === 0;

      accountRef.current = nextAccount;
      setAccount(nextAccount);
      stepRef.current = resume;
      setStep(resume);
      commit(markStarted(merged, resume, new Date()));
      if (fresh) track(ONBOARDING_EVENTS.started, { mode });
      if (nextAccount.kind !== "guest") scheduleSave();
    })();
  }, [commit, mode, router, scheduleSave, searchParams, track]);

  const loaded = state !== null;
  useEffect(() => {
    if (!loaded) return;
    track(ONBOARDING_EVENTS.stepViewed, { step });
    window.scrollTo({ top: 0 });
  }, [loaded, step, track]);

  // Abandonment: one beacon and one analytics event when the page is hidden mid-flow.
  useEffect(() => {
    const onHide = () => {
      const current = stateRef.current;
      const currentStep = stepRef.current;
      if (!current || currentStep === "paywall" || current.answers.commitment.committedAt) return;
      const last = lastCompletedStep(current);
      track(ONBOARDING_EVENTS.abandoned, { step: currentStep, last_completed_step: last });
      commit(markAbandoned(current, currentStep, new Date()));
      if (accountRef.current.kind !== "guest") sendAbandonBeacon(currentStep, last);
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [commit, track]);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const goTo = useCallback(
    (target: StepId, from: OnboardingState) => {
      stepRef.current = target;
      setStep(target);
      setAnnouncement("");
      apply(markStarted(from, target, new Date()));
    },
    [apply],
  );

  const update = useCallback(
    (patch: Partial<OnboardingAnswers>) => {
      const current = stateRef.current;
      if (current) apply(updateAnswers(current, patch, new Date()));
    },
    [apply],
  );

  const advance = useCallback(
    (patch?: Partial<OnboardingAnswers>) => {
      const current = stateRef.current;
      if (!current) return;
      const now = new Date();
      const from = stepRef.current;
      const updated = markCompleted(patch ? updateAnswers(current, patch, now) : current, from, now);
      // Skip steps that are already answered (for example after "Change something"
      // on the reflection), so editing one answer doesn't mean re-walking the flow.
      const steps = stepsFor(updated.answers);
      const ahead = steps.slice(steps.indexOf(from) + 1);
      const target = ahead.find((candidate) => !isStepComplete(candidate, updated)) ?? nextStep(from, updated.answers) ?? "paywall";
      goTo(target, updated);
    },
    [goTo],
  );

  const back = useCallback(() => {
    const current = stateRef.current;
    if (!current) return;
    const target = previousStep(stepRef.current, current.answers);
    if (target) goTo(target, current);
  }, [goTo]);

  const ensureSession = useCallback(async () => {
    if (accountRef.current.kind !== "guest") return true;
    try {
      const { error } = await createClient().auth.signInAnonymously();
      if (error) return false;
      const nextAccount: Account = { kind: "anonymous", firstName: null };
      accountRef.current = nextAccount;
      setAccount(nextAccount);
      scheduleSave();
      return true;
    } catch {
      return false;
    }
  }, [scheduleSave]);

  /**
   * Writes the "Did we get this right?" playback while the building animation
   * plays. Falls back to the template on any failure; never throws.
   */
  const writeInsight = useCallback(async () => {
    const current = stateRef.current;
    if (!current || currentInsight(current.answers)) return;
    const key = insightKey(current.answers);
    let insight = null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const response = await fetch("/api/onboarding/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: current.answers }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
      const data = (await response.json().catch(() => null)) as { insight?: unknown } | null;
      const parsed = parseInsight(data?.insight);
      if (parsed && parsed.key === key) insight = parsed;
    } catch {
      // Timeout or network error: the template below stands in.
    }
    const latest = stateRef.current;
    if (!latest || insightKey(latest.answers) !== key) return;
    const final = insight ?? templateInsight(latest.answers);
    track(ONBOARDING_EVENTS.insightGenerated, { insight_source: final.source });
    update({ insight: final });
  }, [track, update]);

  const buildPlan = useCallback(async () => {
    await Promise.all([saveNow(), writeInsight()]);
    await saveNow();
    const current = stateRef.current;
    track(ONBOARDING_EVENTS.planGenerated, {
      provisional_level: current ? provisionalLevel(current.answers) : null,
      minutes: current?.answers.availability.minutes ?? null,
      days: current?.answers.availability.days ?? null,
    });
  }, [saveNow, track, writeInsight]);

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  const jumpTo = useCallback(
    (target: StepId) => {
      const current = stateRef.current;
      if (current && canVisit(target, current)) goTo(target, current);
    },
    [goTo],
  );

  if (!state) {
    return (
      <Shell>
        <p className="py-10 text-center text-[15px]" style={{ color: MUTED }} role="status">
          Loading your plan…
        </p>
      </Shell>
    );
  }

  if (step === "paywall") {
    return (
      <PaywallStep
        state={state}
        track={track}
        mode={mode}
        onBeforeCheckout={async () => {
          markActivationPending();
          await saveNow(true);
        }}
        onNotNow={() => {
          void saveNow().finally(() => router.push(mode === "app" ? "/app/onboarding?activate=1" : "/"));
        }}
      />
    );
  }

  const props: StepProps = {
    state,
    update,
    next: advance,
    back: previousStep(step, state.answers) ? back : null,
    progress: progressFor(step, state.answers),
    track,
    announce,
    jumpTo,
  };

  const wide = step === "plan" || step === "commitment" || step === "reviews" || step === "reflect";

  return (
    <Shell wide={wide}>
      <LiveRegion message={announcement} />
      <div key={step} data-step={step} data-testid="onboarding-step">
        {step === "goal" ? <GoalStep {...props} /> : null}
        {step === "interests" ? <InterestsStep {...props} /> : null}
        {step === "level" ? <LevelStep {...props} /> : null}
        {step === "experience" ? <ExperienceStep {...props} /> : null}
        {step === "using_pain" ? <UsingPainStep {...props} /> : null}
        {step === "learning_pain" ? <LearningPainStep {...props} /> : null}
        {step === "reviews" ? <ReviewsStep {...props} /> : null}
        {step === "calibration" ? <CalibrationStep {...props} /> : null}
        {step === "pronunciation" ? <PronunciationStep {...props} ensureSession={ensureSession} /> : null}
        {step === "availability" ? <AvailabilityStep {...props} /> : null}
        {step === "building" ? <BuildingStep {...props} serverWork={buildPlan} /> : null}
        {step === "reflect" ? <ReflectStep {...props} /> : null}
        {step === "plan" ? <PlanStep {...props} /> : null}
        {step === "commitment" ? (
          <CommitmentStep
            {...props}
            defaultName={account.firstName}
            next={(patch) => {
              advance(patch);
              void saveNow();
            }}
          />
        ) : null}
      </div>
    </Shell>
  );
}
