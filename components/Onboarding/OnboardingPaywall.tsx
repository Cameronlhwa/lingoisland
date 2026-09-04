"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import { hskLabelForCefr } from "@/lib/levelBands";
import {
  HSK_BTN_GRADIENT,
  HSK_BTN_SHADOW,
} from "@/lib/glossy-theme";

const JOURNEY_TOTAL_WORDS = 45;

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

/**
 * Illustrative Mandarin progress visual (not empirical).
 * Personalized path rises sooner than generic study.
 */
function MandarinPathChart({
  startWords,
  endWords,
}: {
  startWords: number;
  endWords: number;
}) {
  const W = 360;
  const H = 150;
  const padL = 44;
  const padR = 52;
  const padT = 18;
  const padB = 22;
  const x0 = padL;
  const xEnd = W - padR;
  const yStart = H - padB;
  const yGoal = padT;
  const xPersGoal = x0 + (xEnd - x0) * 0.72;
  const xGenEnd = xEnd;
  const yGenEnd = yStart - (yStart - yGoal) * 0.38;

  const persPath = `M ${x0} ${yStart} C ${x0 + 42} ${yStart - 6}, ${xPersGoal - 58} ${yGoal + 36}, ${xPersGoal} ${yGoal}`;
  const persArea = `${persPath} L ${xPersGoal} ${yStart} L ${x0} ${yStart} Z`;
  const genPath = `M ${x0} ${yStart} C ${x0 + 62} ${yStart - 2}, ${xGenEnd - 78} ${yGenEnd + 22}, ${xGenEnd} ${yGenEnd}`;

  const persLabelX = x0 + (xPersGoal - x0) * 0.48;
  const persLabelY = yStart - (yStart - yGoal) * 0.58 - 8;
  const genLabelX = x0 + (xGenEnd - x0) * 0.7;
  const genLabelY = yGenEnd + 14;

  return (
    <div className="flex h-full min-h-0 flex-col" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="flex shrink-0 items-end justify-between gap-3 px-0.5">
        <div>
          <p className="lingo-display" style={{ fontSize: 22, lineHeight: 1, color: "var(--lingo-navy, #071E2E)" }}>
            {startWords}
          </p>
          <p
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--lingo-text-muted, #5A7A90)",
              marginTop: 3,
            }}
          >
            Words now
          </p>
        </div>
        <div className="text-right">
          <p className="lingo-display" style={{ fontSize: 22, lineHeight: 1, color: "#168E9E" }}>
            {endWords}
          </p>
          <p
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#168E9E",
              marginTop: 3,
              opacity: 0.9,
            }}
          >
            This journey
          </p>
        </div>
      </div>

      <div className="relative mt-1 min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
          className="overflow-visible"
        >
          <defs>
            <linearGradient id="mandarinStroke" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2176AE" />
              <stop offset="100%" stopColor="#2BBBAD" />
            </linearGradient>
            <linearGradient id="mandarinFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2BBBAD" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#2176AE" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          <line
            x1={x0}
            y1={yStart}
            x2={xEnd}
            y2={yStart}
            stroke="rgba(33,118,174,0.1)"
            strokeWidth={1}
          />
          <path d={persArea} fill="url(#mandarinFill)" stroke="none" />
          <path
            d={genPath}
            fill="none"
            stroke="#9aabb8"
            strokeWidth={1.75}
            strokeDasharray="5 4"
            strokeLinecap="round"
            opacity={0.85}
          />
          <text
            x={genLabelX}
            y={genLabelY}
            textAnchor="middle"
            fill="#8a9aab"
            fontSize={10}
            fontWeight={600}
            fontFamily="DM Sans, system-ui, sans-serif"
          >
            Generic study
          </text>
          <path
            d={persPath}
            fill="none"
            stroke="url(#mandarinStroke)"
            strokeWidth={3.25}
            strokeLinecap="round"
          />
          <text
            x={persLabelX}
            y={persLabelY}
            textAnchor="middle"
            fill="#12314a"
            fontSize={10.5}
            fontWeight={700}
            fontFamily="DM Sans, system-ui, sans-serif"
          >
            Your personalized path
          </text>
          <circle cx={x0} cy={yStart} r={4.5} fill="#fff" stroke="#2176AE" strokeWidth={2.25} />
          <circle
            cx={xPersGoal}
            cy={yGoal}
            r={5.5}
            fill="#168E9E"
            style={{ filter: "drop-shadow(0 0 4px rgba(22,142,158,0.4))" }}
          />
        </svg>
      </div>

      <p
        className="shrink-0 text-center leading-snug"
        style={{ fontSize: 10.5, color: "var(--lingo-text-muted, #5A7A90)", paddingTop: 2 }}
      >
        Focus on the right words, in the right order, through topics you care about.
      </p>
    </div>
  );
}

const GRAPH_CARD_H = 236;

export default function OnboardingPaywall({
  topic,
  journeyTopic,
  islandLevel = "B1",
  islandName,
  wordsLearned = 0,
  wordsPerWeek = 40,
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
  const startWords = Math.max(0, wordsLearned);
  const endWords = JOURNEY_TOTAL_WORDS;

  const previewUnits = useMemo(() => {
    const units: { name: string; zh: string | null }[] = [];
    if (islandName) {
      units.push({ name: islandName, zh: null });
    }
    const sorted = [...lockedIslands].sort((a, b) => a.order - b.order);
    for (const node of sorted) {
      if (node.node_type !== "island") continue;
      units.push({ name: node.name, zh: node.zh });
      if (units.length >= 4) break;
    }
    if (units.length === 0) {
      units.push({ name: topic || "Your first island", zh: null });
    }
    return units;
  }, [islandName, lockedIslands, topic]);

  const includeRows = [
    { label: "Full personalized journey", free: "Preview", upgrade: true },
    { label: `${JOURNEY_TOTAL_WORDS} curated words`, free: "—", upgrade: true },
    { label: "Story checkpoints", free: "—", upgrade: true },
    { label: "Chat practice with 华华", free: "—", upgrade: true },
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
        className="relative z-10 my-auto w-full max-w-[900px] rounded-[22px] bg-white px-5 py-6 sm:px-6"
        style={{
          boxShadow: "0 14px 36px -20px rgba(7,30,46,0.3), 0 1px 4px rgba(33,118,174,0.06)",
          border: "1px solid rgba(33,118,174,0.08)",
        }}
      >
        <div className="text-center">
          <p
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#2176AE",
            }}
          >
            Your Mandarin roadmap is ready
          </p>
          <h1
            className="lingo-display"
            style={{
              fontSize: "clamp(22px, 3.2vw, 28px)",
              color: "#071E2E",
              marginTop: 5,
            }}
          >
            Your personalized path to{" "}
            <span style={{ color: "#2176AE" }}>better Mandarin</span>
          </h1>
          <div
            className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[12.5px]"
            style={{ color: "#5A7A90" }}
          >
            {motivationLabel && (
              <span className="font-semibold" style={{ color: "#071E2E" }}>
                {motivationLabel}
              </span>
            )}
            {motivationLabel && <span style={{ opacity: 0.35 }}>·</span>}
            <span className="font-semibold" style={{ color: "#071E2E" }}>
              {displayJourneyTitle}
            </span>
            <span style={{ opacity: 0.35 }}>·</span>
            <span>{levelChip}</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 min-[820px]:grid-cols-2 min-[820px]:gap-5">
          {/* Left: islands + what's included */}
          <div className="flex flex-col">
            <div className="mb-1.5">
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#5A7A90",
                }}
              >
                Your first personalized islands
              </p>
              <p className="mt-0.5 text-[11px]" style={{ color: "#5A7A90" }}>
                Built around your goals · {JOURNEY_TOTAL_WORDS} words in this journey
              </p>
            </div>

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

            <p className="mt-1.5 text-center text-[11px] font-semibold" style={{ color: "#2BBBAD" }}>
              + more islands ahead in your journey
            </p>

            <div
              className="mt-auto overflow-hidden rounded-lg border"
              style={{ borderColor: "#C2DCF0", marginTop: 12 }}
            >
              <div
                className="grid grid-cols-[1fr_72px] items-center gap-1 px-2.5 py-1.5"
                style={{
                  background: "#EAF6FB",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#5A7A90",
                }}
              >
                <span>What&apos;s included</span>
                <div className="grid grid-cols-2 gap-0.5 text-center">
                  <span>Free</span>
                  <span style={{ color: "#2176AE" }}>Pro</span>
                </div>
              </div>
              {includeRows.map((row, i) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[1fr_72px] items-center gap-1 px-2.5 py-1.5"
                  style={{
                    borderTop: "1px solid #C2DCF0",
                    fontSize: 11.5,
                    color: "#071E2E",
                    background: i % 2 === 0 ? "#fff" : "rgba(238,249,252,0.4)",
                    lineHeight: 1.3,
                    minHeight: 28,
                  }}
                >
                  <span className="truncate">{row.label}</span>
                  <div className="grid grid-cols-2 gap-0.5 text-center text-[10.5px] font-semibold">
                    <span style={{ color: "#5A7A90" }}>{row.free}</span>
                    <span className="inline-flex justify-center" style={{ color: "#2BBBAD" }}>
                      <Check size={11} aria-label="Included" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: path visual → pricing → CTA */}
          <div className="flex flex-col">
            <div
              className="flex flex-col"
              style={{
                background: "linear-gradient(160deg, #F7FCFF 0%, #EAF6FB 100%)",
                border: "1px solid #C2DCF0",
                borderRadius: 14,
                padding: "10px 12px 8px",
                height: GRAPH_CARD_H,
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#5A7A90",
                  marginBottom: 6,
                  lineHeight: 1.2,
                  flexShrink: 0,
                }}
              >
                Your path to conversational Mandarin
              </p>
              <div className="min-h-0 flex-1">
                <MandarinPathChart startWords={startWords} endWords={endWords} />
              </div>
            </div>

            <div className="mt-auto pt-3 flex gap-2">
              <button
                type="button"
                onClick={() => onBillingIntervalChange("monthly")}
                className="relative flex-1 text-left transition-all"
                style={{
                  borderRadius: 12,
                  padding: "8px 10px",
                  border: `1.5px solid ${billingInterval === "monthly" ? "#2BBBAD" : "#C2DCF0"}`,
                  background: billingInterval === "monthly" ? "rgba(43,187,173,0.08)" : "#fff",
                }}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#5A7A90",
                    }}
                  >
                    Monthly
                  </span>
                  {billingInterval === "monthly" && (
                    <Check size={12} style={{ color: "#2BBBAD" }} />
                  )}
                </div>
                <div className="lingo-display" style={{ fontSize: 16, color: "#071E2E", marginTop: 2 }}>
                  $9.99
                </div>
                <div style={{ fontSize: 10, color: "#5A7A90" }}>per month</div>
              </button>

              <button
                type="button"
                onClick={() => onBillingIntervalChange("yearly")}
                className="relative flex-1 text-left transition-all"
                style={{
                  borderRadius: 12,
                  padding: "8px 10px",
                  border: `1.5px solid ${billingInterval === "yearly" ? "#2BBBAD" : "#C2DCF0"}`,
                  background: billingInterval === "yearly" ? "rgba(43,187,173,0.08)" : "#fff",
                }}
              >
                <span
                  className="absolute -top-1.5 right-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white"
                  style={{ background: "#2176AE" }}
                >
                  Best value
                </span>
                <div className="flex items-center justify-between gap-1">
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#5A7A90",
                    }}
                  >
                    Annual
                  </span>
                  {billingInterval === "yearly" && (
                    <Check size={12} style={{ color: "#2BBBAD" }} />
                  )}
                </div>
                <div className="lingo-display" style={{ fontSize: 16, color: "#071E2E", marginTop: 2 }}>
                  $6.67
                </div>
                <div style={{ fontSize: 10, color: "#5A7A90" }}>$79.99/yr</div>
              </button>
            </div>

            {checkoutError && (
              <p className="mt-1.5 text-xs text-red-600">{checkoutError}</p>
            )}

            <button
              type="button"
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60 disabled:hover:translate-y-0"
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
            <p className="mt-1.5 text-center text-[11px]" style={{ color: "#5A7A90" }}>
              Cancel anytime from your account settings.
            </p>
            {wordsPerWeek > 0 && (
              <p className="mt-0.5 text-center text-[10px]" style={{ color: "#8AABBF" }}>
                Designed for ~{wordsPerWeek} words/week at your pace
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
