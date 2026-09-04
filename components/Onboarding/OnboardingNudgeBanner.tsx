"use client";

import { AnimatePresence } from "framer-motion";
import OnboardingNudgeCard from "@/components/Onboarding/OnboardingNudgeCard";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useSidebar } from "@/components/app/AppLayoutClient";

/** Inline onboarding nudge — home variant sits below TopBar; inline for island pages. */
export default function OnboardingNudgeBanner({
  variant = "inline",
}: {
  variant?: "inline" | "home";
}) {
  const { currentNudge, dismissNudge, completeNudge } = useOnboarding();
  const { isAnonymous, openSignupModal } = useSidebar();

  if (!currentNudge) return null;

  const card = (
    <AnimatePresence mode="wait">
      <OnboardingNudgeCard
        key={currentNudge.key}
        nudge={currentNudge}
        onDismiss={() => dismissNudge(currentNudge.key)}
        onComplete={() => completeNudge(currentNudge.key)}
        onCtaClick={
          isAnonymous
            ? () => {
                openSignupModal(currentNudge.title);
              }
            : undefined
        }
      />
    </AnimatePresence>
  );

  if (variant === "home") {
    return (
      <div className="border-b border-slate-100 bg-slate-50 px-6 py-4 md:px-8">
        <div className="mx-auto max-w-[1060px]">{card}</div>
      </div>
    );
  }

  return card;
}
