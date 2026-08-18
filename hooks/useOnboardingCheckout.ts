"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import {
  type CheckoutPlan,
  type OnboardingUpgradeSnapshot,
  updateSnapshotPlan,
  writeUpgradeSnapshot,
} from "@/lib/onboarding/onboardingCheckoutStorage";

export function useOnboardingCheckout(snapshot: OnboardingUpgradeSnapshot) {
  const supabase = createClient();
  const pendingPlanRef = useRef<CheckoutPlan>(snapshot.plan);
  const [plan, setPlan] = useState<CheckoutPlan>(snapshot.plan);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persistPlan = useCallback((next: CheckoutPlan) => {
    pendingPlanRef.current = next;
    setPlan(next);
    updateSnapshotPlan(next);
  }, []);

  const startCheckout = useCallback(
    async (interval: CheckoutPlan) => {
      setCheckoutLoading(true);
      setError(null);
      writeUpgradeSnapshot({ ...snapshot, plan: interval });
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            interval,
            cancelContext: "onboarding",
            islandId: snapshot.islandId,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setAuthOpen(true);
          return;
        }
        if (!res.ok || !data?.url) {
          setError(data?.error || "Could not start checkout");
          return;
        }
        window.location.href = data.url as string;
      } catch {
        setError("Could not start checkout. Please try again.");
      } finally {
        setCheckoutLoading(false);
      }
    },
    [snapshot],
  );

  const proceedToCheckout = useCallback(async () => {
    pendingPlanRef.current = plan;
    writeUpgradeSnapshot({ ...snapshot, plan });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.is_anonymous) {
      setAuthOpen(true);
      return;
    }

    await startCheckout(plan);
  }, [plan, snapshot, startCheckout, supabase]);

  const onAuthComplete = useCallback(async () => {
    setAuthOpen(false);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.is_anonymous) {
      setError("Please finish creating your account to continue.");
      return;
    }
    await startCheckout(pendingPlanRef.current);
  }, [startCheckout, supabase]);

  return {
    plan,
    setPlan: persistPlan,
    checkoutLoading,
    authOpen,
    setAuthOpen,
    error,
    proceedToCheckout,
    onAuthComplete,
  };
}
