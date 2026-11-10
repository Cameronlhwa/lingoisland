"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

/** A checkout request that hasn't answered by then is treated as failed so the learner can retry. */
const CHECKOUT_TIMEOUT_MS = 15_000;
/** beforeCheckout is best effort; a slow save must not hold up Checkout. */
const BEFORE_CHECKOUT_MAX_MS = 5_000;

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
  // Set synchronously on the first tap, so taps that land before React
  // re-renders the disabled button can't open a second Checkout session.
  const inFlightRef = useRef(false);

  const release = useCallback(() => {
    inFlightRef.current = false;
    setCheckoutLoading(false);
  }, []);

  // Back from Stripe can restore this page from the back/forward cache while
  // it still shows "Starting checkout".
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      release();
      setRedirecting(false);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [release]);

  const persistPlan = useCallback((next: CheckoutPlan) => {
    pendingPlanRef.current = next;
    setPlan(next);
    updateSnapshotPlan(next);
  }, []);

  /** Callers hold inFlightRef. It is released unless the page is leaving for Stripe or the app. */
  const startCheckout = useCallback(
    async (interval: CheckoutPlan) => {
      setCheckoutLoading(true);
      setError(null);
      writeUpgradeSnapshot({ ...snapshot, plan: interval });
      let leaving = false;
      const controller = new AbortController();
      let timer: number | undefined;
      try {
        const before = optionsRef.current.beforeCheckout?.().catch(() => undefined);
        await Promise.race([before, new Promise((resolve) => window.setTimeout(resolve, BEFORE_CHECKOUT_MAX_MS))]);
        const cancelPath = optionsRef.current.cancelPath;
        timer = window.setTimeout(() => controller.abort(), CHECKOUT_TIMEOUT_MS);
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
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
          leaving = true;
          window.location.href = optionsRef.current.proRedirectPath ?? "/app";
          return;
        }
        if (!res.ok || !data?.url) {
          setRedirecting(false);
          setAuthOpen(false);
          setError(data?.error || "Could not start checkout");
          return;
        }
        leaving = true;
        window.location.href = data.url as string;
      } catch {
        setRedirecting(false);
        setAuthOpen(false);
        setError(
          controller.signal.aborted
            ? "Checkout is taking too long to open. Please try again."
            : "Could not start checkout. Please try again.",
        );
      } finally {
        window.clearTimeout(timer);
        if (!leaving) release();
      }
    },
    [release, snapshot],
  );

  const proceedToCheckout = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setCheckoutLoading(true);
    setError(null);
    pendingPlanRef.current = plan;
    writeUpgradeSnapshot({ ...snapshot, plan });

    let handedOff = false;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || user.is_anonymous) {
        setAuthOpen(true);
        return;
      }

      invalidateSubscriptionCache();
      const pro = await fetchIsPro();
      handedOff = true;
      if (pro) {
        clearUpgradePending();
        window.location.href = proPath;
        return;
      }

      await startCheckout(plan);
    } catch {
      setError("Could not start checkout. Please try again.");
    } finally {
      if (!handedOff) release();
    }
  }, [plan, proPath, release, snapshot, startCheckout, supabase]);

  const onAuthComplete = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setRedirecting(true);
    setError(null);
    const user = await supabase.auth
      .getUser()
      .then(({ data }) => data.user)
      .catch(() => null);
    if (!user || user.is_anonymous) {
      setRedirecting(false);
      setError("Please finish creating your account to continue.");
      release();
      return;
    }

    // Go straight to Checkout. A brand-new account is not Pro, and waiting on
    // entitlements plus Stripe reconcile was flashing other screens first.
    // Already-subscribed accounts get a 409 and are sent into the app.
    await startCheckout(pendingPlanRef.current);
  }, [release, startCheckout, supabase]);

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
