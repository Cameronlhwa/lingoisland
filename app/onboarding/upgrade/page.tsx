import { Suspense } from "react";
import OnboardingUpgradeClient from "./OnboardingUpgradeClient";

export default function OnboardingUpgradePage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center text-[#5A7A90]"
          style={{ background: "rgba(214, 238, 248, 0.92)" }}
        >
          Loading…
        </div>
      }
    >
      <OnboardingUpgradeClient />
    </Suspense>
  );
}
