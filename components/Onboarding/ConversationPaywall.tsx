"use client";

import { Check, X } from "lucide-react";
import ProgressComparisonChart from "./ProgressComparisonChart";
import type { PaywallActivation } from "./OnboardingPaywall";
import type { PaywallPlanPricing } from "./MobileJourneyUpgradeModal";

/** One responsive presentation so mobile and desktop cannot drift apart. */
export default function ConversationPaywall({
  activation,
  pricing,
  billingInterval,
  onBillingIntervalChange,
  fullPage,
  checkoutLoading,
  checkoutError,
  onProceedCheckout,
}: {
  activation: PaywallActivation;
  pricing: PaywallPlanPricing;
  billingInterval: "monthly" | "yearly";
  onBillingIntervalChange: (interval: "monthly" | "yearly") => void;
  fullPage: boolean;
  checkoutLoading: boolean;
  checkoutError: string | null;
  onProceedCheckout: () => void;
}) {
  const yearly = billingInterval === "yearly";
  const selected = pricing[billingInterval];
  const comparison = activation.comparison;

  const planOption = (interval: "monthly" | "yearly", label: string) => {
    const active = billingInterval === interval;
    return (
      <button
        type="button"
        aria-pressed={active}
        disabled={checkoutLoading}
        onClick={() => onBillingIntervalChange(interval)}
        data-testid={`plan-${interval}`}
        className="min-h-[44px] flex-1 rounded-xl px-2.5 py-2 text-center text-[13px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#20674F]"
        style={{
          border: active ? "1.5px solid #20674F" : "1px solid #D5E0E8",
          background: active ? "rgba(32,103,79,0.07)" : "#fff",
          color: active ? "#20674F" : "#5A7A90",
          boxShadow: active ? "inset 0 0 0 1px #20674F" : undefined,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className={`${fullPage ? "relative min-h-[100dvh]" : "fixed inset-0 z-50 overflow-y-auto"} flex items-center justify-center bg-[#EAF6FB] p-3 sm:p-6`}
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      <div
        aria-hidden
        className="hsk-onboarding-bg pointer-events-none fixed inset-0 bg-cover bg-no-repeat"
        style={{ backgroundImage: "url(/onboarding/journey-bg.png)" }}
      />
      <div className="relative my-auto flex w-full max-w-[480px] flex-col items-center">
        <section
          aria-labelledby="conversation-offer-title"
          data-testid="conversation-paywall"
          className="relative w-full rounded-[28px] bg-white px-6 pb-5 pt-8 text-center shadow-[0_20px_60px_-20px_rgba(7,30,46,0.3)] sm:px-9 sm:pb-6 sm:pt-9"
        >
          {activation.onClose || activation.onNotNow ? (
            <button
              type="button"
              aria-label="Close payment offer"
              onClick={activation.onClose ?? activation.onNotNow}
              disabled={checkoutLoading}
              className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-[#795B4B] hover:bg-[#F8F4ED] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#20674F]"
            >
              <X size={22} />
            </button>
          ) : null}

          <h1
            id="conversation-offer-title"
            className="lingo-display mx-auto max-w-[22ch] text-[28px] leading-[1.15] text-[var(--lingo-navy)] sm:text-[32px]"
          >
            {activation.headline}
          </h1>
          <p className="mx-auto mt-2.5 max-w-[360px] text-[15px] leading-relaxed text-[#5A7A90] sm:text-base">
            {activation.subline}
          </p>

          {comparison ? (
            <ProgressComparisonChart
              title={comparison.title}
              weeks={comparison.weeks}
              lingoLabel={comparison.lingoLabel}
              otherLabel={comparison.otherLabel}
            />
          ) : null}

          <ul aria-label="Membership benefits" className="mx-auto mt-4 max-w-[400px] space-y-2.5 text-left">
            {activation.benefits.slice(0, 2).map((benefit) => (
              <li
                key={benefit.title}
                className="flex items-start gap-2.5 text-[14.5px] font-semibold leading-snug text-[var(--lingo-navy)] sm:text-[15px]"
              >
                <Check size={18} strokeWidth={2.8} aria-hidden className="mt-0.5 shrink-0 text-[#20674F]" />
                {benefit.title}
              </li>
            ))}
          </ul>

          <div
            role="group"
            aria-label="Billing plan"
            className="mt-5 flex gap-2"
            data-testid="conversation-plan-toggle"
          >
            {planOption("monthly", "Monthly")}
            {planOption("yearly", "Yearly · Save 33%")}
          </div>

          <div
            data-testid="conversation-price"
            className="mt-3 flex items-center gap-3 rounded-2xl border border-[#20674F] bg-white px-4 py-3.5 text-left sm:px-5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold leading-snug text-[var(--lingo-navy)]">
                {yearly ? "Yearly plan" : "Monthly plan"}
              </p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-[#5A7A90]">
                {yearly ? `${selected.note}. Cancel anytime.` : "Billed monthly. Cancel anytime."}
              </p>
            </div>
            <div aria-hidden className="h-10 w-px shrink-0 bg-[#D5E0E8]" />
            <p className="shrink-0 text-right">
              <span className="text-[22px] font-bold leading-none text-[var(--lingo-navy)] sm:text-[24px]">
                {selected.price}
              </span>
              <span className="ml-1 text-[13px] font-semibold text-[#5A7A90]">/ month</span>
            </p>
          </div>

          {checkoutError ? (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {checkoutError}
            </p>
          ) : null}

          <button
            type="button"
            disabled={checkoutLoading}
            onClick={onProceedCheckout}
            className="mt-5 min-h-[54px] w-full rounded-2xl bg-[#20674F] px-4 py-3 text-[17px] font-bold text-white transition-colors hover:bg-[#19533F] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#20674F] disabled:cursor-wait disabled:opacity-60"
          >
            {checkoutLoading ? "Starting checkout…" : activation.cta}
          </button>

          {activation.onNotNow ? (
            <button
              type="button"
              onClick={activation.onNotNow}
              disabled={checkoutLoading}
              className="mt-2 min-h-11 px-4 text-sm font-semibold text-[#5A7A90] hover:text-[var(--lingo-navy)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#20674F]"
            >
              {activation.notNowLabel ?? "Not now"}
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}
