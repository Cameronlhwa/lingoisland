import { Suspense } from "react";
import type { Metadata } from "next";
import JourneyOnboardingFlow from "@/components/Onboarding/JourneyOnboardingFlow";
import PersonalizedOnboardingFlow from "@/components/Onboarding/personalized/PersonalizedOnboardingFlow";

export const metadata: Metadata = {
  title: "Build Your Mandarin Plan | LingoIsland",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

/** Links into the earlier journey flow (an island already generated, or its texting resume) keep working. */
function usesLegacyFlow(params: SearchParams) {
  return Boolean(params.islandId) || params.resume === "texting" || params.track === "hsk";
}

/** Public entry: build a personalized plan before showing the paywall. */
export default function OnboardingJourneyPage({ searchParams = {} }: { searchParams?: SearchParams }) {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center"
          style={{
            fontFamily: "'DM Sans', system-ui, sans-serif",
            background: "#EAF6FB",
            color: "#4F6E83",
          }}
        >
          Loading…
        </div>
      }
    >
      {usesLegacyFlow(searchParams) ? <JourneyOnboardingFlow publicSurface /> : <PersonalizedOnboardingFlow mode="public" />}
    </Suspense>
  );
}
