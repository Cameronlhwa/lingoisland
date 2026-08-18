"use client";

import { useMemo } from "react";
import {
  BookOpen,
  Check,
  Lock,
  Map,
  MessageCircle,
  Rocket,
  Sparkles,
  Star,
} from "lucide-react";

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
  billingInterval: "yearly" | "monthly";
  onBillingIntervalChange: (interval: "yearly" | "monthly") => void;
  onProceedCheckout: () => void;
  checkoutLoading?: boolean;
  checkoutError?: string | null;
  fullPage?: boolean;
}

function WordsGrowthChart({
  startWords,
  endWords,
  weeks,
}: {
  startWords: number;
  endWords: number;
  weeks: number;
}) {
  const w = 280;
  const h = 100;
  const pad = { l: 8, r: 8, t: 12, b: 28 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  const yFor = (words: number) => {
    const t = (words - startWords) / Math.max(endWords - startWords, 1);
    return pad.t + plotH * (1 - t);
  };

  const x0 = pad.l;
  const x1 = pad.l + plotW;
  const y0 = yFor(startWords);
  const y1 = yFor(endWords);
  const midX = pad.l + plotW * 0.45;
  const midY = yFor(startWords + (endWords - startWords) * 0.35);

  const path = `M ${x0} ${y0} Q ${midX} ${midY} ${x1} ${y1}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" aria-hidden>
      <defs>
        <linearGradient id="wordsLine" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2176AE" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#2176AE" />
        </linearGradient>
        <linearGradient id="wordsFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2176AE" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#2176AE" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${path} L ${x1} ${h - pad.b} L ${x0} ${h - pad.b} Z`}
        fill="url(#wordsFill)"
      />
      <path
        d={path}
        fill="none"
        stroke="url(#wordsLine)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle
        cx={x0}
        cy={y0}
        r="4"
        fill="#fff"
        stroke="#2176AE"
        strokeWidth="2"
      />
      <circle cx={x1} cy={y1} r="5" fill="#2176AE" />
      <text
        x={x0}
        y={h - 6}
        className="fill-[#5A7A90] text-[10px] font-medium"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        Today · {startWords}
      </text>
      <text
        x={x1}
        y={h - 6}
        textAnchor="end"
        className="fill-[#071E2E] text-[10px] font-semibold"
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        ~{weeks} wk · {endWords}
      </text>
    </svg>
  );
}

export default function OnboardingPaywall({
  topic,
  journeyTopic,
  islandLevel = "B1",
  islandName,
  wordsLearned = 3,
  wordsPerWeek = 40,
  lockedIslands = [],
  billingInterval,
  onBillingIntervalChange,
  onProceedCheckout,
  checkoutLoading = false,
  checkoutError = null,
  fullPage = false,
}: OnboardingPaywallProps) {
  const displayJourneyTitle = journeyTopic || topic;
  const wordsRemaining = JOURNEY_TOTAL_WORDS - wordsLearned;
  const weeksToComplete = Math.max(
    1,
    Math.ceil(wordsRemaining / Math.max(wordsPerWeek, 10)),
  );

  const journeyPath = useMemo(() => {
    const nodes: Array<{
      key: string;
      label: string;
      sub?: string;
      type: "island" | "story";
      status: "done" | "locked" | "next";
    }> = [
      {
        key: "island-1",
        label: islandName || "Island 1",
        sub: `${wordsLearned} words · you just learned these`,
        type: "island",
        status: "done",
      },
    ];

    const sorted = [...lockedIslands].sort((a, b) => a.order - b.order);
    let islandNum = 2;
    let markedNext = false;
    for (const node of sorted) {
      const isNext = !markedNext && node.node_type === "island";
      if (isNext) markedNext = true;
      nodes.push({
        key: `${node.node_type}-${node.order}`,
        label: node.name,
        sub:
          node.node_type === "story"
            ? node.hint || "Story checkpoint"
            : node.zh || `Island ${islandNum} · 10 words`,
        type: node.node_type,
        status: isNext ? "next" : "locked",
      });
      if (node.node_type === "island") islandNum++;
    }

    return nodes;
  }, [islandName, lockedIslands, wordsLearned]);

  return (
    <div
      className={
        fullPage
          ? "flex min-h-screen items-center justify-center overflow-y-auto p-4 sm:p-6"
          : "fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6"
      }
      style={{ background: "rgba(214, 238, 248, 0.92)" }}
    >
      <div className="my-auto w-full max-w-[920px] overflow-hidden rounded-2xl border border-[#C2DCF0] bg-white shadow-xl">
        <div className="border-b border-[#E8F3FA] px-6 py-5 text-center sm:px-8">
          <p
            className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#2176AE]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            <Sparkles className="mr-1 inline h-3.5 w-3.5" />
            Your personalised journey is ready
          </p>
          <h2
            className="text-2xl font-bold text-[#2176AE] sm:text-[28px]"
            style={{ fontFamily: "'Lora', Georgia, serif" }}
          >
            {displayJourneyTitle}
          </h2>
          <div
            className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-[#5A7A90]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            <span className="rounded-full bg-[#EAF4FB] px-3 py-0.5 text-xs font-semibold text-[#2176AE]">
              {islandLevel}
            </span>
            <span>5 islands · 2 stories · {JOURNEY_TOTAL_WORDS} words</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
          <div className="border-b border-[#E8F3FA] px-6 py-6 lg:border-b-0 lg:border-r">
            <div className="mb-5 rounded-xl border border-[#C2DCF0] bg-[#F4FAFE] p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest text-[#5A7A90]"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Words you&apos;ll know
                  </p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      className="text-3xl font-bold text-[#071E2E]"
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {JOURNEY_TOTAL_WORDS}
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      +{wordsRemaining} more
                    </span>
                  </div>
                  <p
                    className="mt-1 text-xs text-[#5A7A90]"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    You know {wordsLearned} today — finish this journey and
                    you&apos;ll use them in real conversations.
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-[#2176AE] shadow-sm"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  ~{weeksToComplete} wk
                </span>
              </div>
              <WordsGrowthChart
                startWords={wordsLearned}
                endWords={JOURNEY_TOTAL_WORDS}
                weeks={weeksToComplete}
              />
            </div>

            <p
              className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#8AABBF]"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              Your journey path
            </p>
            <ul className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
              {journeyPath.map((node) => (
                <li
                  key={node.key}
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${
                    node.status === "done"
                      ? "border-emerald-200 bg-emerald-50/60"
                      : node.status === "next"
                        ? "border-[#2176AE]/40 bg-[#EAF4FB]"
                        : "border-[#E8F3FA] bg-[#FAFCFE] opacity-80"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      node.status === "done"
                        ? "bg-emerald-500 text-white"
                        : node.type === "story"
                          ? "bg-amber-100 text-amber-600"
                          : "bg-[#E8F3FA] text-[#8AABBF]"
                    }`}
                  >
                    {node.status === "done" ? (
                      <Check className="h-4 w-4" strokeWidth={3} />
                    ) : node.type === "story" ? (
                      <BookOpen className="h-3.5 w-3.5" />
                    ) : (
                      <Lock className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`truncate text-sm font-semibold ${
                        node.status === "done"
                          ? "text-emerald-900"
                          : "text-[#071E2E]"
                      }`}
                      style={{ fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {node.label}
                    </p>
                    {node.sub ? (
                      <p
                        className="truncate text-[11px] text-[#5A7A90]"
                        style={{ fontFamily: "'DM Sans', sans-serif" }}
                      >
                        {node.sub}
                      </p>
                    ) : null}
                  </div>
                  {node.status === "done" ? (
                    <span className="shrink-0 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      Done
                    </span>
                  ) : node.status === "next" ? (
                    <span className="shrink-0 rounded-full bg-[#2176AE] px-2 py-0.5 text-[10px] font-bold text-white">
                      Up next
                    </span>
                  ) : node.type === "story" ? (
                    <span className="shrink-0 text-[10px] font-bold text-amber-600">
                      Story
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col px-6 py-6 sm:px-7">
            <h3
              className="text-xl font-bold text-[#071E2E]"
              style={{ fontFamily: "'Lora', Georgia, serif" }}
            >
              Don&apos;t lose the momentum
            </h3>
            <p
              className="mt-2 text-sm leading-relaxed text-[#5A7A90]"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              You just used new words in a real sentence. Unlock the rest of
              your {displayJourneyTitle} journey and keep building — one island
              at a time.
            </p>

            <ul className="mt-5 space-y-3">
              {[
                {
                  icon: Map,
                  text: "Finish all 5 islands — vocabulary tailored to your topic",
                },
                {
                  icon: BookOpen,
                  text: "2 story checkpoints — hear your words in real context",
                },
                {
                  icon: MessageCircle,
                  text: "Chat with 华华 anytime — grammar, usage, pronunciation",
                },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF4FB] text-[#2176AE]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span
                    className="pt-1 text-sm text-[#071E2E]"
                    style={{ fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {text}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onBillingIntervalChange("monthly")}
                className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                  billingInterval === "monthly"
                    ? "border-[#2176AE] bg-[#EAF4FB]/50 shadow-sm"
                    : "border-[#E8F3FA] bg-white hover:border-[#C2DCF0]"
                }`}
              >
                <p
                  className="text-xs font-semibold text-[#5A7A90]"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Monthly
                </p>
                <p
                  className="mt-1 text-2xl font-bold text-[#071E2E]"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  $9.99
                  <span className="text-sm font-normal text-[#5A7A90]">
                    /mo
                  </span>
                </p>
              </button>

              <button
                type="button"
                onClick={() => onBillingIntervalChange("yearly")}
                className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                  billingInterval === "yearly"
                    ? "border-[#2176AE] bg-[#EAF4FB]/50 shadow-sm"
                    : "border-[#E8F3FA] bg-white hover:border-[#C2DCF0]"
                }`}
              >
                <span className="absolute -right-1 -top-2 rounded-full bg-[#2176AE] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  Best value
                </span>
                <p
                  className="text-xs font-semibold text-[#5A7A90]"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Annual
                </p>
                <p
                  className="mt-1 text-2xl font-bold text-[#071E2E]"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  $6.67
                  <span className="text-sm font-normal text-[#5A7A90]">
                    /mo
                  </span>
                </p>
                <p
                  className="text-[10px] text-[#8AABBF]"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  $79.99/yr · save 33%
                </p>
              </button>
            </div>

            <button
              type="button"
              onClick={onProceedCheckout}
              disabled={checkoutLoading}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2176AE] py-4 text-sm font-bold text-white shadow-md transition-all hover:bg-[#1a5f8f] disabled:opacity-70"
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              <Rocket className="h-4 w-4" />
              {checkoutLoading
                ? "Loading..."
                : billingInterval === "yearly"
                  ? "Continue my journey — $79.99/year"
                  : "Continue my journey — $9.99/month"}
            </button>

            {checkoutError ? (
              <p
                className="mt-2 text-center text-xs text-red-600"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {checkoutError}
              </p>
            ) : null}

            <div className="mt-3 flex items-center justify-center gap-1 text-[#8AABBF]">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
                />
              ))}
              <span
                className="ml-1 text-xs"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Cancel anytime · Secure checkout
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
