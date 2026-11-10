"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import OnboardingUpgradeClient from "@/app/onboarding/upgrade/OnboardingUpgradeClient";
import type { PaywallActivation } from "@/components/Onboarding/OnboardingPaywall";
import { ONBOARDING_EVENTS } from "@/lib/onboarding/personalized/analytics";
import { hasMessaging, planFor, type OnboardingState } from "@/lib/onboarding/personalized/flow";
import { conversationOffer } from "@/lib/onboarding/personalized/conversationOffer";
import { getGoal } from "@/lib/onboarding/personalized/goals";
import type { LearningPlan } from "@/lib/onboarding/personalized/plan";
import { timingHasEvent } from "@/lib/onboarding/personalized/painPoints";
import type { StepProps } from "./stepTypes";
import { CARD_BORDER, FieldError, MUTED, NAVY, PrimaryButton, TextButton } from "./ui";

export type FlowMode = "public" | "app";

/** Display label for the pace chart, which reads the exact minutes ("10min", "1h", "1h+"). */
function timeLabelFor(minutes: number) {
  if (minutes > 60) return "1h+";
  if (minutes === 60) return "1h";
  return `${minutes}min`;
}

export function activationCopy(plan: LearningPlan, state: OnboardingState): Omit<PaywallActivation, "onNotNow" | "onClose"> {
  return {
    ...conversationOffer(state.answers, plan),
    eyebrow: "Your plan is ready",
    savedNote: "Your plan is saved, even if you close this page.",
    notNowLabel: "Not now",
  };
}

export function PaywallStep({
  state,
  track,
  mode,
  onBeforeCheckout,
  onNotNow,
  onClose,
}: Pick<StepProps, "state" | "track"> & {
  mode: FlowMode;
  onBeforeCheckout: () => Promise<void>;
  onNotNow: () => void;
  /** X button: leave onboarding and go home. */
  onClose: () => void;
}) {
  const plan = useMemo(() => planFor(state.answers), [state.answers]);
  const viewedRef = useRef(false);

  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    track(ONBOARDING_EVENTS.paywallViewed, { has_messaging: hasMessaging(state.answers) });
  }, [state.answers, track]);

  const basePath = mode === "app" ? "/app/onboarding" : "/onboarding/journey";
  const personalization = useMemo(
    () => ({
      topic: plan.journeyTopic,
      journeyTopic: plan.journeyTopic,
      islandLevel: plan.cefr,
      wordsLearned: 0,
      wordsPerWeek: Math.round((plan.minutesPerDay / 15) * plan.daysPerWeek * 10),
      lockedIslands: plan.journeys.map((journey, index) => ({
        order: index + 1,
        name: journey.title,
        zh: null,
        node_type: "island" as const,
        hint: `About ${journey.minutes} minutes`,
      })),
      motivationLabel: getGoal(plan.goal)?.label,
      interests: plan.interests,
      daysPerWeek: plan.daysPerWeek,
      timeLabel: timeLabelFor(plan.minutesPerDay),
    }),
    [plan],
  );

  const [holdOpen, setHoldOpen] = useState(false);
  // Signed-in learners in the app already have an account, so "Not now" just moves on.
  const openHold = () => {
    if (mode === "app") return onNotNow();
    track(ONBOARDING_EVENTS.holdPlanOpened);
    setHoldOpen(true);
  };
  const activation: PaywallActivation = {
    ...activationCopy(plan, state),
    onClose,
    onNotNow: openHold,
  };

  return (
    <>
    {holdOpen ? (
      <HoldPlanPanel
        upcomingText={timingHasEvent(state.answers.usingPain.timing) ? state.answers.usingPain.upcomingText : null}
        dated={timingHasEvent(state.answers.usingPain.timing)}
        topic={plan.journeyTopic}
        onSaved={() => {
          track(ONBOARDING_EVENTS.holdPlanSaved);
          onNotNow();
        }}
        // "No thanks" keeps them on the paywall: some people close the panel and then decide to buy.
        onSkip={() => setHoldOpen(false)}
      />
    ) : null}
    <OnboardingUpgradeClient
      personalization={personalization}
      activation={activation}
      authReturnPath={`${basePath}?resume=paywall`}
      checkoutOptions={{
        cancelPath: `${basePath}?canceled=1`,
        proRedirectPath: "/app/onboarding?activate=1",
        beforeCheckout: onBeforeCheckout,
      }}
      onProceed={() => track(ONBOARDING_EVENTS.purchaseStarted)}
    />
    </>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Shown on "Not now": keep the plan and capture an email instead of losing the learner. */
function HoldPlanPanel({
  upcomingText,
  dated,
  topic,
  onSaved,
  onSkip,
}: {
  upcomingText: string | null;
  dated: boolean;
  topic: string;
  onSaved: () => void;
  onSkip: () => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const reminder = upcomingText ? `a reminder before ${upcomingText}` : dated ? "a reminder before then" : "a reminder to pick up where you left off";

  const save = async () => {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError("Enter an email like name@example.com");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await fetch("/api/onboarding/save-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, topic: `hold_plan: ${topic}` }),
      });
    } catch {
      // The plan is saved either way; don't block the learner on this.
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center" style={{ background: "rgba(7,30,46,0.45)" }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="hold-plan-title"
        className="w-full max-w-[440px] rounded-3xl bg-white p-6"
        style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
        data-testid="hold-plan"
      >
        <h2 id="hold-plan-title" className="text-[20px] font-bold" style={{ color: NAVY }}>
          Want us to hold your plan?
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed" style={{ color: MUTED }}>
          Leave your email and we&rsquo;ll send you {reminder}.
        </p>
        <label htmlFor="hold-plan-email" className="sr-only">
          Email
        </label>
        <input
          id="hold-plan-email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError(null);
          }}
          placeholder="you@example.com"
          className="mt-4 w-full min-h-[48px] rounded-xl border bg-white px-4 py-3 text-[15px] focus:outline-none focus-visible:ring-2"
          style={{ borderColor: CARD_BORDER, color: NAVY }}
        />
        <FieldError message={error} />
        <PrimaryButton className="mt-4" disabled={saving} onClick={() => void save()} data-testid="hold-plan-save">
          {saving ? "Saving…" : "Hold my plan"}
        </PrimaryButton>
        <TextButton className="mt-2" onClick={onSkip} data-testid="hold-plan-skip">
          No thanks
        </TextButton>
      </div>
    </div>
  );
}
