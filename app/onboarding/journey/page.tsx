import { Suspense } from "react";
import type { Metadata } from "next";
import JourneyOnboardingFlow from "@/components/Onboarding/JourneyOnboardingFlow";

export const metadata: Metadata = {
  title: "Build Your Journey — LingoIsland",
  robots: { index: false, follow: false },
};

/** Public entry: full journey wizard without signing in first (auth at “Build my journey”). */
export default function OnboardingJourneyPage() {
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
      <JourneyOnboardingFlow publicSurface />
    </Suspense>
  );
}
