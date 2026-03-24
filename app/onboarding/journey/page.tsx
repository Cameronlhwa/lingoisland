import { Suspense } from "react";
import JourneyOnboardingFlow from "@/components/Onboarding/JourneyOnboardingFlow";

/** Public entry: full journey wizard without signing in first (auth at “Build my journey”). */
export default function OnboardingJourneyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-slate-600">
            Loading…
          </div>
        }
      >
        <JourneyOnboardingFlow publicSurface />
      </Suspense>
    </div>
  );
}
