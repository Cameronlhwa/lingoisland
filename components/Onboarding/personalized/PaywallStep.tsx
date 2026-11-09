"use client";

import { useEffect, useMemo, useRef } from "react";
import OnboardingUpgradeClient from "@/app/onboarding/upgrade/OnboardingUpgradeClient";
import type { PaywallActivation } from "@/components/Onboarding/OnboardingPaywall";
import { ONBOARDING_EVENTS } from "@/lib/onboarding/personalized/analytics";
import { hasMessaging, planFor, type OnboardingState } from "@/lib/onboarding/personalized/flow";
import { getGoal } from "@/lib/onboarding/personalized/goals";
import type { LearningPlan } from "@/lib/onboarding/personalized/plan";
import type { StepProps } from "./stepTypes";

export type FlowMode = "public" | "app";

/** Display label for the pace chart, which reads the exact minutes ("10min", "1h", "1h+"). */
function timeLabelFor(minutes: number) {
  if (minutes > 60) return "1h+";
  if (minutes === 60) return "1h";
  return `${minutes}min`;
}

export function activationCopy(plan: LearningPlan, state: OnboardingState): Omit<PaywallActivation, "onNotNow"> {
  const minutes = plan.minutesPerDay >= 90 ? "60+" : String(plan.minutesPerDay);
  const messaging = hasMessaging(state.answers);
  return {
    eyebrow: "Activate your plan",
    headline: `Activate your ${minutes}-minute Mandarin plan for ${plan.goalPhrase}`,
    subline: "Your plan is built. Activating it unlocks everything below, tuned to your goal, level, and schedule.",
    desktopEyebrow: "Your plan is ready",
    desktopHeadline: `Build useful Mandarin for ${plan.goalPhrase}`,
    desktopSubline: `A focused ${minutes}-minute plan built around your goals.`,
    desktopBenefits: [
      "Personalized lessons for your goals",
      "Practice with Huahua between lessons",
      "Review that adapts to your progress",
    ],
    benefits: [
      { title: "Personalized Journeys", detail: `Lessons built around ${plan.interestPhrase || "your interests"}` },
      { title: "Huahua conversations", detail: "Practice real Mandarin with Huahua between lessons" },
      {
        title: "Proactive messages",
        detail: messaging ? "Huahua checks in on the schedule you chose" : "Turn on Huahua messages anytime from Account settings",
      },
      { title: "Adaptive difficulty and support", detail: "Pinyin, English, and pace adjust as you improve" },
      { title: "Review from your conversations", detail: "Words you find tricky with Huahua come back for review" },
      { title: "Monthly texting allowance included", detail: "Chat with Huahua by text or WhatsApp at no extra cost" },
    ],
    cta: "Activate my plan",
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
}: Pick<StepProps, "state" | "track"> & {
  mode: FlowMode;
  onBeforeCheckout: () => Promise<void>;
  onNotNow: () => void;
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

  const activation: PaywallActivation = { ...activationCopy(plan, state), onNotNow };

  return (
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
  );
}
