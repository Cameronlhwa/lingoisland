"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import {
  fetchProductAccess,
  invalidateSubscriptionCache,
} from "@/hooks/useSubscription";

export type HskCheckoutPlan = "monthly" | "yearly";

/**
 * Anonymous-then-real-account checkout gate for the HSK plan-reveal screen —
 * mirrors hooks/useOnboardingCheckout.ts (core $9.99/mo flow), but posts
 * product: "hsk" so /api/stripe/checkout selects the HSK price IDs instead of
 * the core ones. See OnboardingCheckoutAuth for the auth modal this opens.
 */
export function useHskCheckout() {
  const supabase = createClient();
  const pendingPlanRef = useRef<HskCheckoutPlan>("monthly");
  const [plan, setPlan] = useState<HskCheckoutPlan>("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = useCallback(async (interval: HskCheckoutPlan) => {
    setCheckoutLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interval,
          product: "hsk",
          cancelContext: "onboarding",
          cancelPath: `/onboarding/hsk?resume=1&canceled=1&plan=${interval}`,
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
  }, []);

  const proceedToCheckout = useCallback(async () => {
    pendingPlanRef.current = plan;
    setError(null);
    // Prefer a fresh JWT so a just-converted anonymous user isn't still
    // flagged is_anonymous from a stale session.
    await supabase.auth.refreshSession().catch(() => null);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.is_anonymous) {
      setAuthOpen(true);
      return;
    }

    invalidateSubscriptionCache();
    if ((await fetchProductAccess()).isHskPro) {
      window.location.href = "/hsk/app";
      return;
    }

    await startCheckout(plan);
  }, [plan, startCheckout, supabase]);

  const onAuthComplete = useCallback(async () => {
    setAuthOpen(false);
    setError(null);
    await supabase.auth.refreshSession().catch(() => null);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.is_anonymous) {
      setAuthOpen(true);
      setError("Please sign in to continue to checkout.");
      return;
    }

    invalidateSubscriptionCache();
    if ((await fetchProductAccess()).isHskPro) {
      window.location.href = "/hsk/app";
      return;
    }

    await startCheckout(pendingPlanRef.current);
  }, [startCheckout, supabase]);

  return {
    plan,
    setPlan: (next: HskCheckoutPlan) => {
      pendingPlanRef.current = next;
      setPlan(next);
    },
    checkoutLoading,
    authOpen,
    setAuthOpen,
    error,
    proceedToCheckout,
    onAuthComplete,
  };
}
