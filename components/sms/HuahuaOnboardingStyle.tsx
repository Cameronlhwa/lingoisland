"use client";

import { useEffect, useRef, useState } from "react";
import HuahuaStylePicker from "@/components/sms/HuahuaStylePicker";
import { huahuaApi } from "@/components/sms/huahuaApi";
import type { HuahuaOverview } from "@/lib/sms/huahua/publicTypes";

/** Optional style choices shown right after a number is verified in onboarding. */
export default function HuahuaOnboardingStyle() {
  const [overview, setOverview] = useState<HuahuaOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const requestRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void huahuaApi.load().then((result) => {
      if (cancelled) return;
      if (result.ok && !("unavailable" in result.data)) setOverview(result.data);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) return null;
  if (!overview) {
    return <p className="mt-6 text-xs text-gray-500">Loading texting options…</p>;
  }

  const update = async (patch: { persona?: HuahuaOverview["preferences"]["persona"]; correctionMode?: HuahuaOverview["preferences"]["correctionMode"] }) => {
    const previous = overview;
    const requestId = ++requestRef.current;
    setOverview({ ...overview, preferences: { ...overview.preferences, ...patch } });
    const result = await huahuaApi.update(patch);
    if (requestId !== requestRef.current) return;
    if (result.ok && !("unavailable" in result.data)) {
      setOverview(result.data);
      setStatus("saved");
    } else {
      setOverview(previous);
      setStatus("error");
    }
  };

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-left" data-testid="huahua-onboarding-style">
      <HuahuaStylePicker
        persona={overview.preferences.persona}
        correctionMode={overview.preferences.correctionMode}
        allowedPersonas={overview.plan.personas}
        onChange={(patch) => void update(patch)}
      />
      <p className="text-xs text-gray-500" aria-live="polite">
        {status === "saved"
          ? "Saved. You can change this anytime on the Texting page."
          : status === "error"
            ? "Couldn't save that. You can change it later on the Texting page."
            : "Optional. You can change this anytime on the Texting page."}
      </p>
    </div>
  );
}
