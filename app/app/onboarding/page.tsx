import { Suspense } from "react";
import JourneyOnboardingFlow from "@/components/Onboarding/JourneyOnboardingFlow";
import ActivationScreen from "@/components/Onboarding/personalized/ActivationScreen";
import PersonalizedOnboardingFlow from "@/components/Onboarding/personalized/PersonalizedOnboardingFlow";
import AppPageLoading from "@/components/app/AppPageLoading";

type SearchParams = Record<string, string | string[] | undefined>;

export default function AppOnboardingPage({ searchParams = {} }: { searchParams?: SearchParams }) {
  const content =
    searchParams.activate === "1" ? (
      <ActivationScreen />
    ) : searchParams.track === "hsk" || searchParams.islandId ? (
      <JourneyOnboardingFlow />
    ) : (
      <PersonalizedOnboardingFlow mode="app" />
    );
  return <Suspense fallback={<AppPageLoading className="bg-[#EAF6FB]" />}>{content}</Suspense>;
}
