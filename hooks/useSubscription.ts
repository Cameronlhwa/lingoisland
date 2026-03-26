"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type SubscriptionState = {
  isPro: boolean;
  isLoading: boolean;
};

let cachedIsPro: boolean | null = null;
let inflight: Promise<boolean> | null = null;

async function fetchIsPro(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("profiles")
    .select("plan, current_period_end")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return false;

  const isProPlan = data.plan === "pro";
  if (!isProPlan) return false;

  const periodEnd =
    typeof data.current_period_end === "string"
      ? new Date(data.current_period_end)
      : null;

  // Lifetime/manual grants can have null period end; Stripe-backed Pro should be in the future.
  return !periodEnd || periodEnd.getTime() > Date.now();
}

export function useSubscription(): SubscriptionState {
  const [isPro, setIsPro] = useState<boolean>(cachedIsPro ?? false);
  const [isLoading, setIsLoading] = useState<boolean>(cachedIsPro === null);

  useEffect(() => {
    let active = true;

    if (cachedIsPro !== null) {
      setIsPro(cachedIsPro);
      setIsLoading(false);
      return;
    }

    if (!inflight) {
      inflight = fetchIsPro()
        .then((result) => {
          cachedIsPro = result;
          return result;
        })
        .finally(() => {
          inflight = null;
        });
    }

    void inflight.then((result) => {
      if (!active) return;
      setIsPro(result);
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  return { isPro, isLoading };
}

