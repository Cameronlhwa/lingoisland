import { Suspense } from "react";
import JourneyOnboardingFlow from "@/components/Onboarding/JourneyOnboardingFlow";

export default function AppOnboardingPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center"
          style={{
            fontFamily: "'DM Sans', system-ui, sans-serif",
            background: "#EAF6FB",
            color: "#5A7A90",
          }}
        >
          Loading…
        </div>
      }
    >
      <JourneyOnboardingFlow />
    </Suspense>
  );
}
