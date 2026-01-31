"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { cardBaseClass } from "@/components/app/ui/styles";
import { useTTS } from "@/contexts/TTSContext";

type Entitlements = {
  plan: "free" | "pro";
  isPro: boolean;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
  cancel_at_period_end: boolean;
};

const reasons = [
  "Too expensive",
  "Not using it enough",
  "Didn’t find it helpful",
  "Content quality wasn’t good",
  "Missing features",
  "Technical issues / bugs",
  "Other",
];

export default function AccountModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [cefrLevel, setCefrLevel] = useState<string>("B1");
  const [levelLoading, setLevelLoading] = useState(false);
  const [entitlementsLoading, setEntitlementsLoading] = useState(true);
  const [entitlementsError, setEntitlementsError] = useState<string | null>(
    null,
  );
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<"subscription" | "profile">(
    "subscription",
  );
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [checkoutLoading, setCheckoutLoading] = useState<
    "monthly" | "yearly" | null
  >(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [comeback, setComeback] = useState<string>("");
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [ttsRateSentences, setTtsRateSentences] = useState(1.0);
  const [ttsRateWords, setTtsRateWords] = useState(1.0);
  const [ttsSaving, setTtsSaving] = useState(false);
  const [ttsSaveStatus, setTtsSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle",
  );
  const ttsDebounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { settings: ttsSettings, updateSettings: updateTtsSettings } =
    useTTS();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const loadUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        onClose();
        router.push("/login");
        return;
      }
      setUserEmail(user.email ?? null);
      setUserName(
        (user.user_metadata?.full_name as string | undefined) ?? null,
      );
    };
    void loadUser();
  }, [open, router, supabase, onClose]);

  useEffect(() => {
    if (!open) return;
    const loadEntitlements = async () => {
      setEntitlementsLoading(true);
      setEntitlementsError(null);
      try {
        const response = await fetch("/api/entitlements", {
          cache: "no-store",
        });
        if (response.status === 401) {
          onClose();
          router.push("/login");
          return;
        }
        const data = await response.json();
        if (!response.ok) {
          setEntitlementsError(data.error || "Failed to load entitlements.");
          return;
        }
        setEntitlements(data);
      } catch (error) {
        console.error("Error loading entitlements:", error);
        setEntitlementsError("Failed to load entitlements.");
      } finally {
        setEntitlementsLoading(false);
      }
    };
    void loadEntitlements();
  }, [open, router, onClose]);

  useEffect(() => {
    if (!open) {
      setShowPlanPicker(false);
      setCancelOpen(false);
      setFeedbackError(null);
      setReason("");
      setDetails("");
      setComeback("");
    }
  }, [open]);

  useEffect(() => {
    if (!open || !entitlements) return;
    setActiveTab(entitlements.plan === "pro" ? "profile" : "subscription");
  }, [open, entitlements]);

  useEffect(() => {
    if (!open) return;
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/profile");
        if (response.ok) {
          const data = await response.json();
          setCefrLevel(data.cefrLevel || "B1");
          setTtsRateSentences(data.ttsRateSentences || 1.0);
          setTtsRateWords(data.ttsRateWords || 1.0);
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      }
    };
    void loadProfile();
  }, [open]);

  const renewalDate = useMemo(() => {
    if (!entitlements?.current_period_end) return null;
    const date = new Date(entitlements.current_period_end);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString();
  }, [entitlements?.current_period_end]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    onClose();
    router.push("/");
  };

  const startCheckout = async (interval: "monthly" | "yearly") => {
    if (checkoutLoading) return;
    setCheckoutLoading(interval);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });

      if (response.status === 401) {
        onClose();
        router.push("/login");
        return;
      }

      const data = await response.json();
      if (!response.ok || !data.url) {
        console.error("Checkout failed:", data.error);
        return;
      }

      window.location.href = data.url;
    } catch (error) {
      console.error("Error starting checkout:", error);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const openBillingPortal = async () => {
    if (portalLoading) return;
    setPortalLoading(true);
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      if (response.status === 401) {
        onClose();
        router.push("/login");
        return;
      }
      const data = await response.json();
      if (!response.ok || !data.url) {
        console.error("Failed to open billing portal:", data.error);
        return;
      }
      window.location.href = data.url;
    } catch (error) {
      console.error("Error opening billing portal:", error);
    } finally {
      setPortalLoading(false);
    }
  };

  const handleFeedbackSubmit = async () => {
    if (!reason) {
      setFeedbackError("Please select a reason to continue.");
      return;
    }
    setFeedbackError(null);
    setFeedbackLoading(true);

    try {
      const response = await fetch("/api/billing/cancellation-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          details: details.trim() ? details.trim() : null,
          comeback: comeback || null,
          planAtTime: entitlements?.plan ?? "pro",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error(
          "Failed to save feedback:",
          data.error || response.status,
        );
      }
    } catch (error) {
      console.error("Error saving feedback:", error);
    } finally {
      setFeedbackLoading(false);
      setCancelOpen(false);
      void openBillingPortal();
    }
  };

  const handleLevelChange = async (newLevel: string) => {
    setLevelLoading(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cefrLevel: newLevel }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update level");
      }

      const data = await response.json();
      setCefrLevel(data.cefrLevel);
    } catch (error) {
      console.error("Error updating level:", error);
      alert(error instanceof Error ? error.message : "Failed to update level");
    } finally {
      setLevelLoading(false);
    }
  };

  const saveTtsSettings = useCallback(
    async (sentencesRate: number, wordsRate: number) => {
      setTtsSaving(true);
      setTtsSaveStatus("idle");
      try {
        await updateTtsSettings({
          ttsRateSentences: sentencesRate,
          ttsRateWords: wordsRate,
        });
        setTtsSaveStatus("saved");
        setTimeout(() => setTtsSaveStatus("idle"), 2000);
      } catch (error) {
        console.error("Error saving TTS settings:", error);
        setTtsSaveStatus("error");
        setTimeout(() => setTtsSaveStatus("idle"), 3000);
      } finally {
        setTtsSaving(false);
      }
    },
    [updateTtsSettings],
  );

  const handleTtsRateChange = useCallback(
    (type: "sentences" | "words", value: number) => {
      const clampedValue = Math.max(0.25, Math.min(2.0, value));
      const roundedValue = Math.round(clampedValue * 100) / 100;

      if (type === "sentences") {
        setTtsRateSentences(roundedValue);
      } else {
        setTtsRateWords(roundedValue);
      }

      // Debounce the save
      if (ttsDebounceTimeoutRef.current) {
        clearTimeout(ttsDebounceTimeoutRef.current);
      }

      ttsDebounceTimeoutRef.current = setTimeout(() => {
        void saveTtsSettings(
          type === "sentences" ? roundedValue : ttsRateSentences,
          type === "words" ? roundedValue : ttsRateWords,
        );
      }, 500);
    },
    [ttsRateSentences, ttsRateWords, saveTtsSettings],
  );

  const handleTtsReset = useCallback(async () => {
    setTtsRateSentences(1.0);
    setTtsRateWords(1.0);
    if (ttsDebounceTimeoutRef.current) {
      clearTimeout(ttsDebounceTimeoutRef.current);
    }
    await saveTtsSettings(1.0, 1.0);
  }, [saveTtsSettings]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="button"
      tabIndex={0}
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape" || event.key === "Enter") {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] rounded-2xl bg-white p-6 shadow-xl md:min-h-[520px] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-sm text-gray-500 hover:text-gray-700 z-10"
          aria-label="Close account"
        >
          ✕
        </button>

        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Account</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage your profile and subscription.
          </p>
        </div>

        <div className="flex gap-2 rounded-full border border-gray-200 bg-gray-50 p-1 text-sm font-medium text-gray-600">
          <button
            onClick={() => setActiveTab("subscription")}
            className={`rounded-full px-4 py-1.5 transition ${
              activeTab === "subscription"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Subscription
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`rounded-full px-4 py-1.5 transition ${
              activeTab === "profile"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Profile
          </button>
        </div>

        {activeTab === "profile" ? (
          <div className={`${cardBaseClass} mt-6 p-6`}>
            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                <h2 className="text-base font-semibold text-gray-900">
                  Profile
                </h2>
                <div className="text-sm text-gray-600">
                  {userName ? (
                    <div className="font-medium text-gray-900">{userName}</div>
                  ) : null}
                  <div>{userEmail ?? "Loading..."}</div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="level-select"
                  className="text-sm font-medium text-gray-900"
                >
                  Default Chinese Level
                </label>
                <p className="text-xs text-gray-600">
                  This will be used as the default level when creating new Topic
                  Islands.
                </p>
                <select
                  id="level-select"
                  value={cefrLevel}
                  onChange={(e) => handleLevelChange(e.target.value)}
                  disabled={levelLoading}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
                >
                  <option value="A1">A1 (Beginner)</option>
                  <option value="A2">A2 (Elementary)</option>
                  <option value="B1">B1 (Intermediate)</option>
                  <option value="B2">B2 (Upper Intermediate)</option>
                  <option value="C1">C1 (Advanced)</option>
                </select>
              </div>

              <div className="flex flex-col gap-4 border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Audio (Text-to-Speech)
                  </h3>
                  {ttsSaveStatus === "saved" ? (
                    <span className="text-xs font-medium text-green-600">
                      Saved
                    </span>
                  ) : ttsSaveStatus === "error" ? (
                    <span className="text-xs font-medium text-red-600">
                      Error saving
                    </span>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="tts-sentences"
                        className="text-sm font-medium text-gray-900"
                      >
                        Sentences & Stories speed
                      </label>
                      <span className="text-sm font-medium text-gray-700">
                        {ttsRateSentences.toFixed(2)}×
                      </span>
                    </div>
                    <input
                      id="tts-sentences"
                      type="range"
                      min="0.25"
                      max="2.0"
                      step="0.05"
                      value={ttsRateSentences}
                      onChange={(e) =>
                        handleTtsRateChange(
                          "sentences",
                          parseFloat(e.target.value),
                        )
                      }
                      disabled={ttsSaving}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        background: `linear-gradient(to right, #111827 0%, #111827 ${((ttsRateSentences - 0.25) / (2.0 - 0.25)) * 100}%, #e5e7eb ${((ttsRateSentences - 0.25) / (2.0 - 0.25)) * 100}%, #e5e7eb 100%)`,
                      }}
                    />
                    <p className="text-xs text-gray-600">
                      Slower helps with listening practice.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="tts-words"
                        className="text-sm font-medium text-gray-900"
                      >
                        Word speed
                      </label>
                      <span className="text-sm font-medium text-gray-700">
                        {ttsRateWords.toFixed(2)}×
                      </span>
                    </div>
                    <input
                      id="tts-words"
                      type="range"
                      min="0.25"
                      max="2.0"
                      step="0.05"
                      value={ttsRateWords}
                      onChange={(e) =>
                        handleTtsRateChange("words", parseFloat(e.target.value))
                      }
                      disabled={ttsSaving}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{
                        background: `linear-gradient(to right, #111827 0%, #111827 ${((ttsRateWords - 0.25) / (2.0 - 0.25)) * 100}%, #e5e7eb ${((ttsRateWords - 0.25) / (2.0 - 0.25)) * 100}%, #e5e7eb 100%)`,
                      }}
                    />
                    <p className="text-xs text-gray-600">
                      Make single-word pronunciation clearer.
                    </p>
                  </div>

                  <button
                    onClick={handleTtsReset}
                    disabled={ttsSaving}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reset to default (1.0×)
                  </button>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-[1.15fr_1fr]">
            {/* Left decorative panel - conditional based on Pro status */}
            {entitlements?.plan === "pro" ? (
              // Pro user - show success/confirmation design
              <div
                className="relative min-h-[360px] overflow-hidden rounded-2xl border border-emerald-200 p-7 text-white shadow-sm"
                style={{
                  backgroundImage: "url('/Upgrade-modal.jpg')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/70 via-emerald-950/40 to-emerald-950/70" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">✓</span>
                    <h2 className="text-2xl font-semibold drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
                      You're Pro!
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                    You have full access to all LingoIsland features.
                  </p>
                  <div className="mt-7 rounded-2xl border border-white/30 bg-white/15 p-5 text-sm shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-md">
                    <p className="font-semibold drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                      Your Pro Benefits
                    </p>
                    <ul className="mt-2 space-y-1 text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                      <li>✓ Unlimited Topic Islands (vocab + native examples)</li>
                      <li>✓ Story regeneration + longer stories</li>
                      <li>
                        ✓ 24/7 Mandarin coach (instant corrections + explanations)
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              // Free user - show upgrade prompt
              <div
                className="relative min-h-[360px] overflow-hidden rounded-2xl border border-slate-200 p-7 text-white shadow-sm"
                style={{
                  backgroundImage: "url('/Upgrade-modal.jpg')",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-slate-950/70 via-slate-950/40 to-slate-950/70" />
                <div className="relative z-10">
                  <h2 className="text-2xl font-semibold drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)]">
                    Upgrade to Pro
                  </h2>
                  <p className="mt-2 text-sm text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                    Unlock unlimited stories, decks, and focused practice.
                  </p>
                  <div className="mt-7 rounded-2xl border border-white/30 bg-white/15 p-5 text-sm shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-md">
                    <p className="font-semibold drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                      What you get
                    </p>
                    <ul className="mt-2 space-y-1 text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                      <li>Unlimited Topic Islands (vocab + native examples)</li>
                      <li>Story regeneration + longer stories</li>
                      <li>
                        24/7 Mandarin coach (instant corrections + explanations)
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <div className={`${cardBaseClass} min-h-[360px] p-6`}>
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">
                      Subscription
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                      Speed up your mandarin journey by learning the words you
                      actually use!
                    </p>
                  </div>
                  {entitlements?.plan === "pro" ? (
                    <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white">
                      Pro
                    </span>
                  ) : null}
                </div>

                {entitlementsLoading ? (
                  <div className="mt-4 text-sm text-gray-500">
                    Loading plan...
                  </div>
                ) : entitlementsError ? (
                  <div className="mt-4 text-sm text-red-600">
                    {entitlementsError}
                  </div>
                ) : entitlements?.plan === "pro" ? (
                  // Pro user view - show benefits and management
                  <div className="mt-6 flex flex-1 flex-col gap-4">
                    {renewalDate ? (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">
                          {entitlements.cancel_at_period_end 
                            ? "Subscription Ending" 
                            : "Active Pro Subscription"}
                        </p>
                        <p className="mt-1 text-xs text-gray-600">
                          {entitlements.cancel_at_period_end ? (
                            <>
                              Active until{" "}
                              <span className="font-medium">{renewalDate}</span>
                            </>
                          ) : (
                            <>
                              Renews on{" "}
                              <span className="font-medium">{renewalDate}</span>
                            </>
                          )}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">
                          Pro Access
                        </p>
                        <p className="mt-1 text-xs text-gray-600">
                          Lifetime access • No renewal required
                        </p>
                      </div>
                    )}

                    <div className="space-y-2.5 rounded-lg border border-gray-200 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Your Pro Benefits
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-green-600">✓</span>
                          <span className="text-sm text-gray-700">
                            Unlimited Topic Islands & vocab
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-green-600">✓</span>
                          <span className="text-sm text-gray-700">
                            Unlimited stories & content
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-green-600">✓</span>
                          <span className="text-sm text-gray-700">
                            24/7 AI tutor with corrections
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto space-y-2">
                      {renewalDate && (
                        <button
                          onClick={openBillingPortal}
                          disabled={portalLoading}
                          className="inline-flex w-full items-center justify-center rounded-lg border border-gray-900 bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {portalLoading ? "Opening..." : "Manage Subscription"}
                        </button>
                      )}
                      {renewalDate && !entitlements.cancel_at_period_end && (
                        <button
                          onClick={() => setCancelOpen(true)}
                          className="w-full text-center text-xs font-medium text-gray-500 hover:text-red-600"
                        >
                          Cancel subscription
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  // Free user view - show upgrade options
                  <div className="mt-6 flex flex-1 flex-col gap-4">
                    <div className="flex flex-1 flex-col gap-4">
                      <div className="space-y-3 pt-1">
                        {[
                          { id: "monthly", label: "Monthly", price: "$9.99" },
                          { id: "yearly", label: "Yearly", price: "$79.99" },
                        ].map((plan) => (
                          <button
                            key={plan.id}
                            onClick={() =>
                              setSelectedPlan(plan.id as "monthly" | "yearly")
                            }
                            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                              selectedPlan === plan.id
                                ? "border-gray-300 bg-gray-200 text-gray-900"
                                : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                            }`}
                          >
                            <span>{plan.label}</span>
                            <span>{plan.price}</span>
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => startCheckout(selectedPlan)}
                        disabled={checkoutLoading !== null}
                        className="mt-auto inline-flex w-full items-center justify-center rounded-lg border border-gray-900 bg-gray-900 px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {checkoutLoading ? "Opening..." : "Upgrade Now"}
                      </button>
                      <div className="flex items-center gap-3 pt-1 text-sm font-semibold text-gray-600">
                        <div className="flex -space-x-2">
                          {["🏝️", "⛵️", "🥥"].map((emoji) => (
                            <span
                              key={emoji}
                              className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-sm"
                            >
                              {emoji}
                            </span>
                          ))}
                        </div>
                        <span>Join the LingoIsland Community!</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {cancelOpen ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Before you go…
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                You’ll finish cancellation on Stripe in the next step.
              </p>
            </div>

            <div className="space-y-4 text-sm text-gray-700">
              <div>
                <p className="mb-2 font-medium text-gray-900">
                  What’s the main reason you’re leaving?
                </p>
                <div className="space-y-2">
                  {reasons.map((option) => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="reason"
                        value={option}
                        checked={reason === option}
                        onChange={() => setReason(option)}
                        className="h-4 w-4"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block font-medium text-gray-900">
                  What could we do better?
                </label>
                <textarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
                  placeholder="Optional"
                />
              </div>

              <div>
                <p className="mb-2 font-medium text-gray-900">
                  Would you consider coming back?
                </p>
                <div className="flex flex-wrap gap-3">
                  {["Yes", "Maybe", "No"].map((option) => (
                    <label key={option} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="comeback"
                        value={option}
                        checked={comeback === option}
                        onChange={() => setComeback(option)}
                        className="h-4 w-4"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              {feedbackError ? (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  {feedbackError}
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                onClick={() => {
                  setCancelOpen(false);
                  setFeedbackError(null);
                }}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Keep Pro
              </button>
              <button
                onClick={handleFeedbackSubmit}
                disabled={feedbackLoading}
                className="rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {feedbackLoading ? "Submitting..." : "Continue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
