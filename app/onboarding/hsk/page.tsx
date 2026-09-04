import { Suspense } from "react";
import type { Metadata } from "next";
import HskOnboardingFlow from "@/components/Onboarding/hsk/HskOnboardingFlow";

export const metadata: Metadata = {
  title: "Find Your HSK Level — LingoIsland",
  robots: { index: false, follow: false },
};

export default function HskOnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-slate-600">
          Loading…
        </div>
      }
    >
      <HskOnboardingFlow />
    </Suspense>
  );
}
