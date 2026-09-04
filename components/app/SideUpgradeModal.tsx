"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import {
  productLabel,
  type BillableProduct,
} from "@/lib/product-plans";
import {
  HSK_BTN_GRADIENT,
  HSK_BTN_SHADOW,
  LINGO_ACCENT_TINT,
} from "@/lib/glossy-theme";

type SideUpgradeModalProps = {
  open: boolean;
  onClose: () => void;
  /** Product the user is trying to switch into. */
  product: BillableProduct;
};

/**
 * Shown when a subscribed user tries to switch to the other app side
 * without that product's premium entitlement.
 */
export default function SideUpgradeModal({
  open,
  onClose,
  product,
}: SideUpgradeModalProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<"monthly" | "yearly" | null>(
    null,
  );
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) setBilling("monthly");
  }, [open, product]);

  if (!open || !mounted) return null;

  const label = productLabel(product);
  const isHsk = product === "hsk";
  const monthlyPrice = isHsk ? "$14.99" : "$9.99";
  const yearlyPrice = isHsk ? "$9.99" : "$6.67";
  const yearlyBilling = isHsk ? "$119.88/year" : "$79.99/year";

  const startCheckout = async (interval: "monthly" | "yearly") => {
    if (checkoutLoading) return;
    setCheckoutLoading(interval);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interval,
          product: isHsk ? "hsk" : "core",
          cancelContext: "pricing",
        }),
      });

      if (response.status === 401) {
        onClose();
        router.push("/login");
        return;
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) {
        return;
      }

      window.location.href = data.url as string;
    } finally {
      setCheckoutLoading(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-[22px] bg-white"
        style={{
          border: "1px solid rgba(33,118,174,0.12)",
          boxShadow:
            "0 20px 48px -18px rgba(7,30,46,0.38), 0 2px 6px rgba(33,118,174,0.08)",
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 rounded-full bg-[#F1F7FA] px-2.5 py-1.5 text-sm font-semibold text-[#5A7A90] transition-colors hover:bg-[#E3F0F6]"
          aria-label="Close modal"
        >
          ✕
        </button>

        <div className="px-7 pb-7 pt-8">
          <p
            className="text-[10.5px] font-bold uppercase tracking-[0.14em]"
            style={{ color: "#2176AE" }}
          >
            Upgrade required
          </p>
          <h2
            className="lingo-display mt-2 text-[28px] leading-none tracking-[-0.025em]"
            style={{ color: "#071E2E" }}
          >
            Add {label}
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "#5A7A90" }}>
            Your current plan stays active. Add {label} to access both learning
            experiences whenever you want.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className="relative rounded-xl px-3 py-3 text-left transition-all"
              style={{
                border: `1.5px solid ${billing === "monthly" ? "#2BBBAD" : "#C2DCF0"}`,
                background:
                  billing === "monthly" ? LINGO_ACCENT_TINT : "#fff",
              }}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.08em]"
                  style={{ color: "#5A7A90" }}
                >
                  Monthly
                </span>
                {billing === "monthly" && (
                  <Check size={14} style={{ color: "#2BBBAD" }} />
                )}
              </div>
              <div
                className="lingo-display mt-1 text-[22px] leading-none"
                style={{ color: "#071E2E" }}
              >
                {monthlyPrice}
              </div>
              <div className="mt-1 text-[11px]" style={{ color: "#5A7A90" }}>
                per month
              </div>
            </button>
            <button
              type="button"
              onClick={() => setBilling("yearly")}
              className="relative rounded-xl px-3 py-3 text-left transition-all"
              style={{
                border: `1.5px solid ${billing === "yearly" ? "#2BBBAD" : "#C2DCF0"}`,
                background:
                  billing === "yearly" ? LINGO_ACCENT_TINT : "#fff",
              }}
            >
              <span
                className="absolute -top-2 right-2 rounded-full px-2 py-0.5 text-[9px] font-bold text-white"
                style={{ background: "#2176AE", boxShadow: "0 4px 10px -4px rgba(33,118,174,0.55)" }}
              >
                Best value
              </span>
              <div className="flex items-center justify-between gap-1">
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.08em]"
                  style={{ color: "#5A7A90" }}
                >
                  Yearly
                </span>
                {billing === "yearly" && (
                  <Check size={14} style={{ color: "#2BBBAD" }} />
                )}
              </div>
              <div
                className="lingo-display mt-1 text-[22px] leading-none"
                style={{ color: "#071E2E" }}
              >
                {yearlyPrice}
              </div>
              <div className="mt-1 text-[11px]" style={{ color: "#5A7A90" }}>
                {yearlyBilling}
              </div>
            </button>
          </div>

          <button
            type="button"
            disabled={!!checkoutLoading}
            onClick={() => void startCheckout(billing)}
            className="mt-4 w-full rounded-xl px-5 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60 disabled:hover:translate-y-0"
            style={{
              background: HSK_BTN_GRADIENT,
              boxShadow: HSK_BTN_SHADOW,
            }}
          >
            {checkoutLoading
              ? "Redirecting…"
              : `Add ${label} — ${billing === "monthly" ? `${monthlyPrice}/mo` : yearlyBilling}`}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full rounded-xl px-5 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
          >
            Stay on current side
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
