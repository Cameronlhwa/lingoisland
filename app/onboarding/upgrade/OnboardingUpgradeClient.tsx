"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import OnboardingPaywall from "@/components/Onboarding/OnboardingPaywall";
import OnboardingCheckoutAuth from "@/components/Onboarding/OnboardingCheckoutAuth";
import { useOnboardingCheckout } from "@/hooks/useOnboardingCheckout";
import {
  type CheckoutPlan,
  type OnboardingUpgradeSnapshot,
  buildUpgradePageUrl,
  markUpgradePending,
  readUpgradeSnapshot,
  writeUpgradeSnapshot,
} from "@/lib/onboarding/onboardingCheckoutStorage";
import {
  invalidateSubscriptionCache,
  useSubscription,
} from "@/hooks/useSubscription";

function planFromParam(value: string | null): CheckoutPlan | null {
  if (value === "monthly" || value === "yearly") return value;
  if (value === "annual") return "yearly";
  return null;
}

const ISLAND_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function OnboardingUpgradeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isPro, isLoading: subscriptionLoading } = useSubscription();
  const autoCheckoutStarted = useRef(false);

  const islandIdRaw = searchParams.get("islandId") ?? "";
  const islandId = ISLAND_ID_RE.test(islandIdRaw) ? islandIdRaw : "";
  const urlPlan = planFromParam(searchParams.get("plan"));
  const autoCheckout = searchParams.get("autoCheckout") === "1";

  const [snapshot, setSnapshot] = useState<OnboardingUpgradeSnapshot | null>(
    null,
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    markUpgradePending();

    const stored = readUpgradeSnapshot();
    const merged: OnboardingUpgradeSnapshot | null =
      stored && (stored.islandId === islandId || !islandId)
        ? {
            ...stored,
            islandId: islandId || stored.islandId,
            plan: urlPlan ?? stored.plan,
          }
        : islandId
          ? {
              v: 1,
              islandId,
              topic: stored?.topic ?? "Your journey",
              journeyTopic: stored?.journeyTopic,
              islandLevel: stored?.islandLevel,
              islandName: stored?.islandName,
              wordsLearned: stored?.wordsLearned ?? 3,
              wordsPerWeek: stored?.wordsPerWeek ?? 40,
              lockedIslands: stored?.lockedIslands,
              plan: urlPlan ?? stored?.plan ?? "yearly",
            }
          : stored;

    if (!merged?.islandId || !ISLAND_ID_RE.test(merged.islandId)) {
      router.replace("/onboarding/journey");
      return;
    }

    writeUpgradeSnapshot(merged);
    setSnapshot(merged);
    setReady(true);
  }, [islandId, router, urlPlan]);

  useEffect(() => {
    if (subscriptionLoading) return;
    if (isPro) {
      router.replace("/app/journey");
    }
  }, [isPro, subscriptionLoading, router]);

  const checkout = useOnboardingCheckout(
    snapshot ?? {
      v: 1,
      islandId: islandId || "pending",
      topic: "Your journey",
      plan: urlPlan ?? "yearly",
    },
  );

  useEffect(() => {
    if (!ready || !snapshot) return;
    if (searchParams.get("canceled") === "1" && urlPlan) {
      checkout.setPlan(urlPlan);
    }
  }, [ready, snapshot, searchParams, urlPlan, checkout.setPlan]);

  const returnPath = useMemo(() => {
    if (!snapshot) return "/onboarding/upgrade";
    return buildUpgradePageUrl(snapshot.islandId);
  }, [snapshot]);

  const runAutoCheckout = useCallback(async () => {
    if (!snapshot || autoCheckoutStarted.current) return;
    autoCheckoutStarted.current = true;
    invalidateSubscriptionCache();
    await checkout.proceedToCheckout();
  }, [checkout, snapshot]);

  useEffect(() => {
    if (!ready || !snapshot || !autoCheckout || subscriptionLoading || isPro) {
      return;
    }
    void runAutoCheckout();
  }, [
    autoCheckout,
    isPro,
    ready,
    runAutoCheckout,
    snapshot,
    subscriptionLoading,
  ]);

  if (!ready || !snapshot || subscriptionLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-[#5A7A90]"
        style={{ background: "rgba(214, 238, 248, 0.92)" }}
      >
        Loading your journey…
      </div>
    );
  }

  if (isPro) return null;

  return (
    <>
      <OnboardingPaywall
        topic={snapshot.topic}
        journeyTopic={snapshot.journeyTopic}
        islandLevel={snapshot.islandLevel}
        islandName={snapshot.islandName}
        wordsLearned={snapshot.wordsLearned}
        wordsPerWeek={snapshot.wordsPerWeek}
        lockedIslands={snapshot.lockedIslands}
        billingInterval={checkout.plan}
        onBillingIntervalChange={checkout.setPlan}
        onProceedCheckout={() => void checkout.proceedToCheckout()}
        checkoutLoading={checkout.checkoutLoading}
        checkoutError={checkout.error}
        fullPage
      />
      {checkout.authOpen ? (
        <OnboardingCheckoutAuth
          plan={checkout.plan}
          returnPath={returnPath}
          onComplete={() => void checkout.onAuthComplete()}
          onCancel={() => checkout.setAuthOpen(false)}
        />
      ) : null}
    </>
  );
}
