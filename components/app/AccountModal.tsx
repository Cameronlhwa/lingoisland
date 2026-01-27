"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { cardBaseClass } from "@/components/app/ui/styles";

type Entitlements = {
  plan: "free" | "pro";
  isPro: boolean;
  current_period_end: string | null;
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
        className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl md:min-h-[520px]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-sm text-gray-500 hover:text-gray-700"
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
            <div className="flex flex-col gap-2">
              <h2 className="text-base font-semibold text-gray-900">Profile</h2>
              <div className="text-sm text-gray-600">
                {userName ? (
                  <div className="font-medium text-gray-900">{userName}</div>
                ) : null}
                <div>{userEmail ?? "Loading..."}</div>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="mt-4 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 md:grid-cols-[1.15fr_1fr]">
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
                ) : (
                  <div className="mt-6 flex flex-1 flex-col gap-4">
                    {entitlements?.plan === "pro" && renewalDate ? (
                      <p className="text-sm text-gray-600">
                        Renews on{" "}
                        <span className="font-medium">{renewalDate}</span>
                      </p>
                    ) : null}

                    {entitlements?.plan === "free" ? (
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
                    ) : (
                      <div className="mt-auto space-y-2">
                        <button
                          onClick={openBillingPortal}
                          disabled={portalLoading}
                          className="inline-flex w-full items-center justify-center rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          {portalLoading ? "Opening..." : "Manage billing"}
                        </button>
                        <button
                          onClick={() => setCancelOpen(true)}
                          className="text-left text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          Downgrade / Cancel
                        </button>
                      </div>
                    )}
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
