"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import {
  parseProductPlan,
  type ProductPlan,
} from "@/lib/product-plans";

type SubscriptionState = {
  /** Islands Pro — used by existing Islands paywalls. */
  isPro: boolean;
  isIslandsPro: boolean;
  isHskPro: boolean;
  plan: ProductPlan;
  isLoading: boolean;
  /** Force a fresh profiles.plan read (e.g. after OAuth). */
  refetch: () => Promise<{
    isIslandsPro: boolean;
    isHskPro: boolean;
    plan: ProductPlan;
  }>;
};

type AccessSnapshot = {
  isIslandsPro: boolean;
  isHskPro: boolean;
  plan: ProductPlan;
};

let cached: AccessSnapshot | null = null;
let inflight: Promise<AccessSnapshot> | null = null;

export function invalidateSubscriptionCache(): void {
  cached = null;
  inflight = null;
}

export async function fetchProductAccess(): Promise<AccessSnapshot> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { isIslandsPro: false, isHskPro: false, plan: "free" };
  }

  const readPlan = async (): Promise<AccessSnapshot> => {
    const response = await fetch("/api/entitlements", {
      cache: "no-store",
    }).catch(() => null);
    if (!response?.ok) {
      return { isIslandsPro: false, isHskPro: false, plan: "free" };
    }
    const data = (await response.json()) as {
      plan?: string;
      isIslandsPro?: boolean;
      isHskPro?: boolean;
    };
    const plan = parseProductPlan(data.plan);

    return {
      plan,
      isIslandsPro: data.isIslandsPro === true,
      isHskPro: data.isHskPro === true,
    };
  };

  const snapshot = await readPlan();
  if (snapshot.isIslandsPro || snapshot.isHskPro) return snapshot;

  // One reconcile attempt per tab session — avoids Stripe calls on every render.
  if (
    typeof window !== "undefined" &&
    !user.is_anonymous &&
    user.email &&
    !sessionStorage.getItem("lingo_stripe_reconcile_v1")
  ) {
    sessionStorage.setItem("lingo_stripe_reconcile_v1", "1");
    try {
      const res = await fetch("/api/stripe/reconcile", { method: "POST" });
      if (res.ok) {
        invalidateSubscriptionCache();
        return await readPlan();
      }
    } catch {
      // ignore — fall through to free
    }
  }

  return snapshot;
}

/** @deprecated Prefer fetchProductAccess — kept for call sites that only need Islands. */
export async function fetchIsPro(): Promise<boolean> {
  const access = await fetchProductAccess();
  return access.isIslandsPro;
}

function loadAccess(): Promise<AccessSnapshot> {
  if (cached !== null) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetchProductAccess()
      .then((result) => {
        cached = result;
        return result;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useSubscription(): SubscriptionState {
  const [access, setAccess] = useState<AccessSnapshot>(
    cached ?? { isIslandsPro: false, isHskPro: false, plan: "free" },
  );
  const [isLoading, setIsLoading] = useState<boolean>(cached === null);

  const apply = useCallback((result: AccessSnapshot) => {
    cached = result;
    setAccess(result);
    setIsLoading(false);
  }, []);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    invalidateSubscriptionCache();
    const result = await fetchProductAccess();
    apply(result);
    return result;
  }, [apply]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    void loadAccess().then((result) => {
      if (!active) return;
      apply(result);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED" &&
        event !== "TOKEN_REFRESHED"
      ) {
        return;
      }
      invalidateSubscriptionCache();
      setIsLoading(true);
      void fetchProductAccess().then((result) => {
        if (!active) return;
        apply(result);
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [apply]);

  return {
    isPro: access.isIslandsPro,
    isIslandsPro: access.isIslandsPro,
    isHskPro: access.isHskPro,
    plan: access.plan,
    isLoading,
    refetch,
  };
}
