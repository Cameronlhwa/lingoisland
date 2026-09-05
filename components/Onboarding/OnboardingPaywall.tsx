"use client";

import { useMemo } from "react";
import Image from "next/image";
import { Check } from "lucide-react";
import { hskLabelForCefr } from "@/lib/levelBands";
import {
  HSK_BTN_GRADIENT,
  HSK_BTN_SHADOW,
} from "@/lib/glossy-theme";

type JourneyNode = {
  order: number;
  name: string;
  zh: string | null;
  node_type: "island" | "story";
  hint: string | null;
};

interface OnboardingPaywallProps {
  topic: string;
  journeyTopic?: string;
  islandLevel?: string;
  islandName?: string;
  wordsLearned?: number;
  wordsPerWeek?: number;
  lockedIslands?: JourneyNode[];
  motivationLabel?: string;
  billingInterval: "yearly" | "monthly";
  onBillingIntervalChange: (interval: "yearly" | "monthly") => void;
  onProceedCheckout: () => void;
  checkoutLoading?: boolean;
  checkoutError?: string | null;
  fullPage?: boolean;
}

export default function OnboardingPaywall({
  topic,
  journeyTopic,
  islandLevel = "B1",
  islandName,
  lockedIslands = [],
  motivationLabel,
  billingInterval,
  onBillingIntervalChange,
  onProceedCheckout,
  checkoutLoading = false,
  checkoutError = null,
  fullPage = false,
}: OnboardingPaywallProps) {
  const displayJourneyTitle = journeyTopic || topic;
  const levelChip = hskLabelForCefr(islandLevel) || islandLevel;

  const previewUnits = useMemo(() => {
    const units: { name: string; zh: string | null }[] = [];
    if (islandName) {
      units.push({ name: islandName, zh: null });
    }
    const sorted = [...lockedIslands].sort((a, b) => a.order - b.order);
    for (const node of sorted) {
      if (node.node_type !== "island") continue;
      units.push({ name: node.name, zh: node.zh });
      if (units.length >= 3) break;
    }
    if (units.length === 0) {
      units.push({ name: topic || "Your first lesson", zh: null });
    }
    return units;
  }, [islandName, lockedIslands, topic]);

  const benefits = [
    "Unlimited lessons — any topic, any time",
    "Full stories built from your real vocabulary",
    "Conversation practice, gently corrected as you speak",
    "Review that adapts as you go, so nothing gets forgotten",
  ];

  return (
    <div
      className={
        fullPage
          ? "relative flex min-h-screen items-center justify-center overflow-y-auto p-4 sm:p-6"
          : "fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6"
      }
      style={{
        background: "#EAF6FB",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "url(/hskprep/hsk-onboarding-bg.png)",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center 40%",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 65% 50% at 50% 30%, rgba(255,255,255,0.72) 0%, rgba(234,246,251,0.45) 55%, rgba(234,246,251,0.85) 100%)",
        }}
      />
      <div
        className="relative z-10 my-auto w-full max-w-[1040px] overflow-hidden rounded-[22px] bg-white"
        style={{
          boxShadow: "0 14px 36px -20px rgba(7,30,46,0.3), 0 1px 4px rgba(33,118,174,0.06)",
          border: "1px solid rgba(33,118,174,0.08)",
        }}
      >
        <div className="grid grid-cols-1 min-[820px]:grid-cols-2">
          <div className="px-5 py-6 sm:px-8 sm:py-10">
            <p className="text-[11px] font-bold" style={{ color: "#2176AE" }}>
              Your personalized plan is ready
            </p>
            <h1
              className="lingo-display mt-3"
              style={{ fontSize: "clamp(28px, 3.2vw, 38px)", lineHeight: 1.12, color: "#071E2E" }}
            >
              Get fluent faster by learning Mandarin around what you love
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed" style={{ color: "#5A7A90" }}>
              No generic textbooks to work through — every lesson is built from topics you actually care about, so it sticks.
            </p>
            <p className="mt-6 text-[12px] leading-snug" style={{ color: "#5A7A90" }}>
              Based on:{" "}
              <span className="font-semibold" style={{ color: "#071E2E" }}>
                {motivationLabel || "your goals"}
              </span>
              {" · "}
              <span className="font-semibold" style={{ color: "#071E2E" }}>
                {displayJourneyTitle}
              </span>
              {" · "}
              <span className="font-semibold" style={{ color: "#071E2E" }}>
                HSK Level {levelChip.replace("HSK ", "")}
              </span>
            </p>
            <div className="flex flex-col gap-1">
              {previewUnits.map((unit, idx) => (
                <div
                  key={`${unit.name}-${idx}`}
                  className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5"
                  style={{ border: "1px solid #C2DCF0", background: "#fff" }}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #2176AE 0%, #2BBBAD 100%)" }}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold leading-tight" style={{ color: "#071E2E" }}>
                      {unit.name}
                    </p>
                    {unit.zh && (
                      <p className="truncate text-[11px] leading-tight" style={{ color: "#5A7A90" }}>
                        {unit.zh}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-3 text-[12px] font-semibold leading-snug" style={{ color: "#2176AE" }}>
              + new lessons anytime, on any topic you choose — this never runs out
            </p>

            <ul className="mt-7 space-y-3 text-[13px]" style={{ color: "#071E2E" }}>
              {[
                "Real example sentences, not flashcard fragments",
                "Short lessons that fit around your schedule",
                "Guided conversation practice with spoken feedback",
              ].map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "#2176AE" }} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div
            className="px-5 py-6 sm:px-8 sm:py-10 min-[820px]:border-l"
            style={{ borderColor: "rgba(33,118,174,0.12)" }}
          >
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onBillingIntervalChange("monthly")}
                className="flex-1 rounded-xl px-3 py-2 text-center text-[13px] font-semibold transition-all"
                style={{
                  border: `2px solid ${billingInterval === "monthly" ? "#2176AE" : "rgba(33,118,174,0.1)"}`,
                  color: "#071E2E",
                  background: "#fff",
                }}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => onBillingIntervalChange("yearly")}
                className="flex-1 rounded-xl px-3 py-2 text-center text-[13px] transition-all"
                style={{
                  border: `1px solid ${billingInterval === "yearly" ? "#2176AE" : "rgba(33,118,174,0.1)"}`,
                  color: "#071E2E",
                  background: billingInterval === "yearly" ? "rgba(33,118,174,0.06)" : "#fff",
                }}
              >
                Annual · best value
              </button>
            </div>
            <div className="mt-5">
              <p className="lingo-display" style={{ fontSize: 38, lineHeight: 1, color: "#071E2E" }}>
                {billingInterval === "monthly" ? "$9.99" : "$6.67"}
                <span className="ml-1 font-sans text-[14px] font-normal" style={{ color: "#5A7A90" }}>/mo</span>
              </p>
              <p className="mt-1 text-[12px]" style={{ color: "#5A7A90" }}>
                {billingInterval === "monthly" ? "Cancel anytime" : "$79.99 billed yearly"}
              </p>
            </div>

            <ul className="mt-6 space-y-3 text-[13px]" style={{ color: "#071E2E" }}>
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2">
                  <Check className="mt-0.5 shrink-0" size={16} style={{ color: "#2176AE" }} aria-hidden />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7">
              <p className="text-[13px] font-bold" style={{ color: "#071E2E" }}>
                Why this works better than learning from textbooks
              </p>
              <div className="mt-4 space-y-3 text-[11px]" style={{ color: "#5A7A90" }}>
                <div>
                  <div className="mb-1 flex justify-between"><span>Typical textbook method</span><span>lower retention</span></div>
                  <div className="h-2 rounded-full" style={{ background: "#E9EEF1" }}>
                    <div className="h-full w-[55%] rounded-full" style={{ background: "#CED6DA" }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between"><span>Learning through your interests</span><span>higher retention</span></div>
                  <div className="h-2 rounded-full" style={{ background: "#E9EEF1" }}>
                    <div className="h-full w-[85%] rounded-full" style={{ background: "#2176AE" }} />
                  </div>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "#5A7A90" }}>
                Based on published research on vocabulary acquisition: content that&apos;s personally relevant is remembered significantly longer than material learned by rote.
              </p>
            </div>

            {checkoutError && (
              <p className="mt-4 text-xs text-red-600">{checkoutError}</p>
            )}

            <button
              type="button"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60 disabled:hover:translate-y-0"
              style={{
                background: HSK_BTN_GRADIENT,
                boxShadow: HSK_BTN_SHADOW,
              }}
              disabled={checkoutLoading}
              onClick={onProceedCheckout}
            >
              {checkoutLoading
                ? "Starting checkout…"
                : "Start my Mandarin plan →"}
            </button>
            <figure
              className="mt-7 flex items-center gap-3 border-t pt-4"
              style={{ borderColor: "rgba(33,118,174,0.12)" }}
            >
              <Image
                src="/Cameron Lim Profile Photo.jpg"
                alt="Cameron Lim"
                width={42}
                height={42}
                className="shrink-0 rounded-full border-2 border-white object-cover"
                style={{ boxShadow: "0 2px 8px rgba(33,118,174,0.18)" }}
                sizes="42px"
              />
              <figcaption>
                <blockquote className="text-[11px] leading-relaxed italic" style={{ color: "#5A7A90" }}>
                  “LingoIsland transformed how I learned Mandarin by personalizing lessons around what I actually needed, not textbook scenarios like opening a bank account in China.”
                </blockquote>
                <p className="mt-1 text-[10px] font-bold" style={{ color: "#2176AE" }}>
                  — Cameron Lim
                </p>
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </div>
  );
}
