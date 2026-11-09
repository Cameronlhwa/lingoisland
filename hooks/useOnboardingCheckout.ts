"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import {
  type CheckoutPlan,
  type OnboardingUpgradeSnapshot,
  clearUpgradePending,
  updateSnapshotPlan,
  writeUpgradeSnapshot,
} from "@/lib/onboarding/onboardingCheckoutStorage";
import {
  fetchIsPro,
  invalidateSubscriptionCache,
} from "@/hooks/useSubscription";

export type OnboardingCheckoutOptions = {
  /** Same-site path Stripe returns to when checkout is canceled. */
  cancelPath?: string;
  /** Runs right before Checkout opens (for example, to save onboarding progress). Errors are ignored. */
  beforeCheckout?: () => Promise<void>;
  /** Where an account that already has Pro goes instead of Checkout. */
  proRedirectPath?: string;
};

export function useOnboardingCheckout(snapshot: OnboardingUpgradeSnapshot, options: OnboardingCheckoutOptions = {}) {
  const supabase = createClient();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const proPath = options.proRedirectPath ?? "/app";
  const pendingPlanRef = useRef<CheckoutPlan>(snapshot.plan);
  const [plan, setPlan] = useState<CheckoutPlan>(snapshot.plan);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
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
        await optionsRef.current.beforeCheckout?.().catch(() => undefined);
        const cancelPath = optionsRef.current.cancelPath;
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            interval,
            cancelContext: "onboarding",
            islandId: snapshot.islandId,
            ...(cancelPath ? { cancelPath: `${cancelPath}${cancelPath.includes("?") ? "&" : "?"}plan=${interval}` } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setRedirecting(false);
          setAuthOpen(true);
          return;
        }
        if (res.status === 409) {
          clearUpgradePending();
          window.location.href = optionsRef.current.proRedirectPath ?? "/app";
          return;
        }
        if (!res.ok || !data?.url) {
          setRedirecting(false);
          setAuthOpen(false);
          setError(data?.error || "Could not start checkout");
          return;
        }
        window.location.href = data.url as string;
      } catch {
        setRedirecting(false);
        setAuthOpen(false);
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

    invalidateSubscriptionCache();
    const pro = await fetchIsPro();
    if (pro) {
      clearUpgradePending();
      window.location.href = proPath;
      return;
    }

    await startCheckout(plan);
  }, [plan, proPath, snapshot, startCheckout, supabase]);

  const onAuthComplete = useCallback(async () => {
    setRedirecting(true);
    setError(null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.is_anonymous) {
      setRedirecting(false);
      setError("Please finish creating your account to continue.");
      return;
    }

    // Go straight to Checkout. A brand-new account is not Pro, and waiting on
    // entitlements plus Stripe reconcile was flashing other screens first.
    // Already-subscribed accounts get a 409 and are sent into the app.
    await startCheckout(pendingPlanRef.current);
  }, [startCheckout, supabase]);

  return {
    plan,
    setPlan: persistPlan,
    checkoutLoading,
    authOpen,
    setAuthOpen,
    redirecting,
    setRedirecting,
    error,
    proceedToCheckout,
    onAuthComplete,
  };
}
