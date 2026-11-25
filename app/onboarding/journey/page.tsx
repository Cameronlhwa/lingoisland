import { Suspense } from "react";
import AppPageLoading from "@/components/app/AppPageLoading";
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
      fallback={<AppPageLoading label="Getting ready…" className="lingo-body bg-[#fffaf3]" />}
    >
      {usesLegacyFlow(searchParams) ? <JourneyOnboardingFlow publicSurface /> : <PersonalizedOnboardingFlow mode="public" />}
    </Suspense>
  );
}
