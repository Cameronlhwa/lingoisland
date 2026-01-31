"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  feature?: string; // Optional feature that triggered the upgrade prompt
}

type Entitlements = {
  plan: "free" | "pro";
  isPro: boolean;
  current_period_end: string | null;
};

export default function UpgradeModal({
  open,
  onClose,
  feature,
}: UpgradeModalProps) {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState<"monthly" | "yearly" | null>(null);
  const [mounted, setMounted] = useState(false);
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    
    const fetchEntitlements = async () => {
      try {
        const response = await fetch("/api/entitlements");
        if (response.ok) {
          const data = await response.json();
          setEntitlements(data);
        }
      } catch (error) {
        console.error("Error fetching entitlements:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEntitlements();
  }, [open]);

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

  if (!open || !mounted) return null;

  const isPro = entitlements?.isPro ?? false;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-6 top-6 z-10 text-2xl text-white hover:text-gray-300 transition-colors"
          aria-label="Close modal"
        >
          ✕
        </button>

        {loading ? (
          <div className="flex items-center justify-center min-h-[400px] p-10">
            <div className="text-gray-600">Loading...</div>
          </div>
        ) : isPro ? (
          // Pro user view - show they already have access
          <div className="grid md:grid-cols-[1.2fr_1fr]">
            {/* Left side - Success message */}
            <div
              className="relative min-h-[400px] md:min-h-[600px] overflow-hidden rounded-l-2xl p-10 text-white"
              style={{
                backgroundImage: "url('/Upgrade-modal.jpg')",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/80 via-emerald-950/60 to-emerald-950/80" />
              <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-center gap-3">
                  <span className="text-5xl">✓</span>
                  <h2 className="text-4xl font-bold drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
                    You're Pro!
                  </h2>
                </div>
                <p className="mt-3 text-lg text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)]">
                  You have full access to all LingoIsland features.
                </p>

                <div className="mt-8 rounded-2xl border border-white/30 bg-white/15 p-6 shadow-[0_16px_40px_rgba(0,0,0,0.4)] backdrop-blur-md">
                  <p className="text-lg font-semibold drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                    Your Pro Benefits
                  </p>
                  <ul className="mt-4 space-y-3 text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                    <li className="flex items-start gap-3">
                      <span className="text-green-400">✓</span>
                      <span>Unlimited Topic Islands (vocab + native examples)</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-green-400">✓</span>
                      <span>Story regeneration + longer stories</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="text-green-400">✓</span>
                      <span>24/7 Mandarin coach (instant corrections + explanations)</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Right side - What they should do */}
            <div className="flex flex-col bg-white p-10 rounded-r-2xl">
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-gray-900">
                  You're all set!
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  You have full access to all Pro features. Start creating unlimited islands and stories!
                </p>

                {feature && (
                  <div className="mt-6 rounded-lg bg-yellow-50 border border-yellow-200 p-4">
                    <p className="text-sm font-medium text-yellow-900">
                      Note: "{feature}" is already available to you as a Pro member.
                    </p>
                    <p className="mt-1 text-xs text-yellow-700">
                      Try refreshing the page if you're experiencing issues.
                    </p>
                  </div>
                )}

                <div className="mt-8 space-y-4">
                  <button
                    onClick={onClose}
                    className="w-full rounded-xl border border-gray-900 bg-gray-900 px-6 py-4 text-lg font-semibold text-white transition-all hover:bg-gray-800"
                  >
                    Continue Using LingoIsland
                  </button>
                  
                  <button
                    onClick={() => {
                      onClose();
                      router.push("/app");
                    }}
                    className="w-full rounded-xl border border-gray-300 bg-white px-6 py-4 text-base font-medium text-gray-700 transition-all hover:bg-gray-50"
                  >
                    Go to Dashboard
                  </button>
                </div>

                <div className="mt-8 text-center text-sm text-gray-500">
                  Need help? Check your account settings to manage your subscription.
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Free user view - show upgrade options
          <div className="grid md:grid-cols-[1.2fr_1fr]">
          {/* Left side - Hero with features */}
          <div
            className="relative min-h-[400px] md:min-h-[600px] overflow-hidden rounded-l-2xl p-10 text-white"
            style={{
              backgroundImage: "url('/Upgrade-modal.jpg')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-slate-950/60 to-slate-950/80" />
            <div className="relative z-10 flex h-full flex-col">
              <h2 className="text-4xl font-bold drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]">
                Upgrade to Pro
              </h2>
              <p className="mt-3 text-lg text-white/90 drop-shadow-[0_2px_10px_rgba(0,0,0,0.4)]">
                Unlock unlimited stories, decks, and focused practice.
              </p>
              {feature && (
                <p className="mt-2 text-sm text-yellow-300/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                  "{feature}" is a Pro feature
                </p>
              )}

              <div className="mt-8 rounded-2xl border border-white/30 bg-white/15 p-6 shadow-[0_16px_40px_rgba(0,0,0,0.4)] backdrop-blur-md">
                <p className="text-lg font-semibold drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]">
                  What you get
                </p>
                <ul className="mt-4 space-y-3 text-white/95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
                  <li className="flex items-start gap-3">
                    <span className="text-green-400">✓</span>
                    <span>Unlimited Topic Islands (vocab + native examples)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-400">✓</span>
                    <span>Story regeneration + longer stories</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-green-400">✓</span>
                    <span>24/7 Mandarin coach (instant corrections + explanations)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Right side - Pricing */}
          <div className="flex flex-col bg-white p-10 rounded-r-2xl">
            <div className="flex-1">
              <h2 className="text-2xl font-semibold text-gray-900">
                Subscription
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Speed up your mandarin journey by learning the words you actually use!
              </p>

              <div className="mt-8 space-y-3">
                {[
                  { id: "monthly", label: "Monthly", price: "$9.99" },
                  { id: "yearly", label: "Yearly", price: "$79.99", save: "Save $40" },
                ].map((plan) => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan.id as "monthly" | "yearly")}
                    className={`flex w-full items-center justify-between rounded-xl border px-5 py-4 text-left transition ${
                      selectedPlan === plan.id
                        ? "border-gray-900 bg-gray-100 shadow-sm"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                          selectedPlan === plan.id
                            ? "border-gray-900 bg-gray-900"
                            : "border-gray-300"
                        }`}
                      >
                        {selectedPlan === plan.id && (
                          <div className="h-2 w-2 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <span className="font-medium text-gray-900">{plan.label}</span>
                        {plan.save && (
                          <span className="ml-2 text-sm text-green-600 font-medium">
                            {plan.save}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-lg font-semibold text-gray-900">{plan.price}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={() => startCheckout(selectedPlan)}
                disabled={checkoutLoading !== null}
                className="mt-8 w-full rounded-xl border border-gray-900 bg-gray-900 px-6 py-4 text-lg font-semibold text-white transition-all hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {checkoutLoading ? "Opening checkout..." : "Upgrade Now"}
              </button>

              <div className="mt-6 flex items-center gap-3 text-sm font-semibold text-gray-600">
                <div className="flex -space-x-2">
                  {["🏝️", "⛵️", "🥥"].map((emoji) => (
                    <span
                      key={emoji}
                      className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-gray-100 text-base"
                    >
                      {emoji}
                    </span>
                  ))}
                </div>
                <span>Join the LingoIsland Community!</span>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>,
    document.body
  );
}
