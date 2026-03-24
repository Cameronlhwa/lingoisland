import { Suspense } from "react";
import JourneyOnboardingFlow from "@/components/Onboarding/JourneyOnboardingFlow";

export default function AppOnboardingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-slate-600">
            Loading…
          </div>
        }
      >
        <JourneyOnboardingFlow />
      </Suspense>
    </div>
  );
}
