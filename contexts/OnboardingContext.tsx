"use client";

import { createContext, useContext, ReactNode } from "react";
import { useOnboardingNudges } from "@/hooks/useOnboardingNudges";
import type { OnboardingStepKey } from "@/types/onboarding";
import type { OnboardingCompletionKey } from "@/types/onboarding";
import type { EntrySource } from "@/types/onboarding";
import type { OnboardingNudge } from "@/types/onboarding";

type OnboardingContextValue = {
  currentNudge: OnboardingNudge | null;
  persistentSettingsNudge: OnboardingNudge | null;
  startOnboardingIfNeeded: (entrySource: EntrySource) => Promise<void>;
  dismissNudge: (key: OnboardingStepKey) => Promise<void>;
  completeNudge: (key: OnboardingCompletionKey) => Promise<void>;
  loading: boolean;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined
);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const hook = useOnboardingNudges();
  return (
    <OnboardingContext.Provider value={hook}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (ctx === undefined) {
    throw new Error("useOnboarding must be used within OnboardingProvider");
  }
  return ctx;
}
