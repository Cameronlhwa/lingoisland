import { Suspense } from "react";
import JourneyOnboardingFlow from "@/components/Onboarding/JourneyOnboardingFlow";
import { createClient } from "@/lib/supabase/server";

const JOURNEY_ONBOARDING_ROLLOUT = new Date("2026-03-24T00:00:00.000Z");

export default async function JourneyCreatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isLegacyUser = !!(
    user?.created_at &&
    new Date(user.created_at) < JOURNEY_ONBOARDING_ROLLOUT
  );

  return (
    <div className="min-h-screen bg-white">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-gray-600">
            Loading…
          </div>
        }
      >
        <JourneyOnboardingFlow
          skipWelcome
          smartProfileSkip={isLegacyUser}
          collectProfileQuestions={isLegacyUser}
        />
      </Suspense>
    </div>
  );
}
