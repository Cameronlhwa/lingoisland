"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import OnboardingCheckoutAuth from "@/components/Onboarding/OnboardingCheckoutAuth";
import { useHskCheckout } from "@/hooks/useHskCheckout";
import { MOTIVATION_BUCKETS, type HskMotivation } from "./hskPersonalizationContent";
import { formatHskLevel } from "@/lib/utils/hsk";
import { cumulativeHsk20WordCount } from "@/lib/hsk/pathStandard";
import VocabularyPathChart from "./VocabularyPathChart";

/**
 * Compact plan-reveal / paywall — sized to fit a laptop viewport in one screen.
 * Story: where you are → personalized curriculum → HSK goal → start.
 */

export type HskCurriculumUnitPreview = {
  unit_number: number;
  title: string;
  title_zh: string | null;
  milestone_level: number;
  status: string;
};

export type HskGenerationResult = {
  journeyId?: string;
  curriculumId?: string;
  unit1JourneyId?: string | null;
  framingPhrase: string;
  journeyTitle: string;
  wordsPerWeek: number;
  /** Curriculum units ("Unit 1", "Unit 2", ...) — the roadmap shown on the reveal. */
  units?: HskCurriculumUnitPreview[];
  /** @deprecated legacy single-journey shape — kept so old callers still type-check. */
  islands?: {
    order: number;
    name: string;
    zh: string | null;
    word_count: number;
    words: { hanzi: string; pinyin: string; english: string | null; level: number }[];
  }[];
  stories?: { afterIsland: 2 | 5; title: string; hint: string }[];
  upcomingUnits?: { title: string; zh: string }[];
};

const TIME_LABEL_DISPLAY: Record<string, string> = {
  "5min": "5 min",
  "15min": "15 min",
  "30min": "30 min",
  "1h+": "60+ min",
};

const MONTHLY_PRICE = "$14.99";
const ANNUAL_PRICE = "$9.99";
const ANNUAL_BILLED = "$119.88/yr";

/** First journeys to preview — keep compact; imply more beyond. */
const PREVIEW_COUNT = 4;

/** Graph card height — slightly taller with the narrower reveal modal. */
const GRAPH_CARD_H = 268;

export default function HskPlanReveal({
  result,
  targetLevel,
  currentLevel,
  timeLabel,
  motivation,
  testDate: _testDate,
  returnPath,
  autoCheckout = false,
  initialPlan,
}: {
  result: HskGenerationResult;
  targetLevel: number;
  currentLevel?: number;
  timeLabel: string;
  motivation: HskMotivation;
  testDate?: string | null;
  returnPath: string;
  autoCheckout?: boolean;
  initialPlan?: "monthly" | "yearly";
}) {
  const {
    plan,
    setPlan,
    checkoutLoading,
    authOpen,
    setAuthOpen,
    error,
    proceedToCheckout,
    onAuthComplete,
  } = useHskCheckout();

  const prefersReducedMotion = useReducedMotion();
  const autoCheckoutStarted = useRef(false);

  useEffect(() => {
    if (initialPlan) setPlan(initialPlan);
  }, [initialPlan, setPlan]);

  useEffect(() => {
    if (!autoCheckout || autoCheckoutStarted.current) return;
    autoCheckoutStarted.current = true;
    void proceedToCheckout();
  }, [autoCheckout, proceedToCheckout]);

  const orderedUnits = [...(result.units ?? [])].sort(
    (a, b) => a.unit_number - b.unit_number,
  );
  const timeDisplay = TIME_LABEL_DISPLAY[timeLabel] ?? timeLabel;
  const motivationMeta = MOTIVATION_BUCKETS.find((b) => b.value === motivation);

  const knownWords =
    typeof currentLevel === "number" ? cumulativeHsk20WordCount(currentLevel) : null;
  const goalWordsRaw = cumulativeHsk20WordCount(targetLevel);
  const hasGoal = knownWords != null && goalWordsRaw > knownWords;
  const showProgression =
    typeof currentLevel === "number" && currentLevel >= 1 && currentLevel !== targetLevel;

  const previewUnits = orderedUnits.slice(0, PREVIEW_COUNT).map((unit) => ({
    name: unit.title,
    zh: unit.title_zh,
  }));
  const hasMoreAhead = orderedUnits.length > PREVIEW_COUNT;

  const includeRows = [
    { label: "Full personalized curriculum", free: "Preview", upgrade: true },
    { label: "HSK vocabulary in context", free: "—", upgrade: true },
    { label: "150+ practice tests", free: "—", upgrade: true },
    { label: "Smart flashcard review", free: "—", upgrade: true },
  ];

  const fadeUp = (delay: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 6 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.3, delay },
        };

  return (
    <div
      className="w-full rounded-[22px] bg-white px-5 py-6 sm:px-6 sm:py-6"
      style={{
        boxShadow: "0 14px 36px -20px rgba(7,30,46,0.3), 0 1px 4px rgba(33,118,174,0.06)",
        border: "1px solid rgba(33,118,174,0.08)",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <motion.div className="text-center" {...fadeUp(0)}>
        <p
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--lingo-blue)",
          }}
        >
          Your HSK roadmap is ready
        </p>
        <h1
          className="lingo-display"
          style={{ fontSize: "clamp(22px, 3.2vw, 28px)", color: "var(--lingo-navy)", marginTop: 5 }}
        >
          Your personalized path to{" "}
          <span style={{ color: "var(--lingo-blue)" }}>{formatHskLevel(targetLevel)}</span>
        </h1>

        <div
          className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[12.5px]"
          style={{ color: "var(--lingo-text-muted)" }}
        >
          {showProgression && (
            <span className="font-semibold" style={{ color: "var(--lingo-navy)" }}>
              {formatHskLevel(currentLevel!)}
              <span style={{ margin: "0 5px", opacity: 0.45 }}>→</span>
              {formatHskLevel(targetLevel)}
            </span>
          )}
          {showProgression && <span style={{ opacity: 0.35 }}>·</span>}
          {motivationMeta && (
            <span className="font-semibold" style={{ color: "var(--lingo-navy)" }}>
              {motivationMeta.label}
            </span>
          )}
          {motivationMeta && <span style={{ opacity: 0.35 }}>·</span>}
          <span>
            {result.framingPhrase}
            <span style={{ margin: "0 5px", opacity: 0.4 }}>·</span>
            {timeDisplay}/day
          </span>
        </div>
      </motion.div>

      <div className="mt-5 grid grid-cols-1 gap-4 min-[820px]:grid-cols-2 min-[820px]:gap-5">
        {/* Left: curriculum preview + what's included */}
        <motion.div className="flex flex-col" {...fadeUp(0.04)}>
          <div className="mb-1.5">
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--lingo-text-muted)",
              }}
            >
              Your first personalized journeys
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--lingo-text-muted)" }}>
              Structured like HSK units · personalized to your goals
            </p>
          </div>

          <div className="flex flex-col gap-1">
            {previewUnits.map((unit, idx) => (
              <div
                key={`${unit.name}-${idx}`}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5"
                style={{ border: "1px solid var(--lingo-border)", background: "#fff" }}
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: "var(--lingo-accent-gradient)" }}
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[13px] font-bold leading-tight"
                    style={{ color: "var(--lingo-navy)" }}
                  >
                    {unit.name}
                  </p>
                  {unit.zh && (
                    <p
                      className="truncate text-[11px] leading-tight"
                      style={{ color: "var(--lingo-text-muted)" }}
                    >
                      {unit.zh}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasMoreAhead && (
            <p
              className="mt-1.5 text-center text-[11px] font-semibold"
              style={{ color: "var(--lingo-teal)" }}
            >
              + more personalized journeys ahead
            </p>
          )}

          <div
            className="mt-auto overflow-hidden rounded-lg border"
            style={{ borderColor: "var(--lingo-border)", marginTop: 12 }}
          >
            <div
              className="grid grid-cols-[1fr_72px] items-center gap-1 px-2.5 py-1.5"
              style={{
                background: "var(--lingo-sky-pale)",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--lingo-text-muted)",
              }}
            >
              <span>What&apos;s included</span>
              <div className="grid grid-cols-2 gap-0.5 text-center">
                <span>Free</span>
                <span style={{ color: "var(--lingo-blue)" }}>Pro</span>
              </div>
            </div>
            {includeRows.map((row, i) => (
              <div
                key={row.label}
                className="grid grid-cols-[1fr_72px] items-center gap-1 px-2.5 py-1.5"
                style={{
                  borderTop: "1px solid var(--lingo-border)",
                  fontSize: 11.5,
                  color: "var(--lingo-navy)",
                  background: i % 2 === 0 ? "#fff" : "rgba(238,249,252,0.4)",
                  lineHeight: 1.3,
                  minHeight: 28,
                }}
              >
                <span className="truncate">{row.label}</span>
                <div className="grid grid-cols-2 gap-0.5 text-center text-[10.5px] font-semibold">
                  <span style={{ color: "var(--lingo-text-muted)" }}>{row.free}</span>
                  <span className="inline-flex justify-center" style={{ color: "var(--lingo-teal)" }}>
                    <Check size={11} aria-label="Included" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right: graph hero → pricing → CTA */}
        <motion.div className="flex flex-col" {...fadeUp(0.08)}>
          <div
            className="flex flex-col"
            style={{
              background: "linear-gradient(160deg, #F7FCFF 0%, #EAF6FB 100%)",
              border: "1px solid var(--lingo-border)",
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
                color: "var(--lingo-text-muted)",
                marginBottom: 6,
                lineHeight: 1.2,
                flexShrink: 0,
              }}
            >
              Your path to {formatHskLevel(targetLevel)}
            </p>
            <div className="min-h-0 flex-1">
              <VocabularyPathChart
                knownWords={knownWords}
                goalWords={hasGoal ? goalWordsRaw : undefined}
                goalLevel={targetLevel}
              />
            </div>
          </div>

          <div className="mt-auto pt-3 flex gap-2">
            <PricingOption
              active={plan === "monthly"}
              onClick={() => setPlan("monthly")}
              label="Monthly"
              price={MONTHLY_PRICE}
              sub="per month"
            />
            <PricingOption
              active={plan === "yearly"}
              onClick={() => setPlan("yearly")}
              label="Annual"
              price={ANNUAL_PRICE}
              sub={ANNUAL_BILLED}
              badge="Best value"
            />
          </div>

          {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

          <button
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60 disabled:hover:translate-y-0"
            style={{
              background: "var(--lingo-accent-gradient)",
              boxShadow: "var(--lingo-accent-shadow)",
            }}
            disabled={checkoutLoading}
            onClick={() => void proceedToCheckout()}
          >
            {checkoutLoading
              ? "Starting checkout…"
              : `Start my ${formatHskLevel(targetLevel)} plan →`}
          </button>
          <p className="mt-1.5 text-center text-[11px]" style={{ color: "var(--lingo-text-muted)" }}>
            Cancel anytime from your account settings.
          </p>
        </motion.div>
      </div>

      {authOpen && (
        <OnboardingCheckoutAuth
          plan={plan}
          returnPath={returnPath}
          onComplete={() => void onAuthComplete()}
          onCancel={() => setAuthOpen(false)}
        />
      )}
    </div>
  );
}

function PricingOption({
  active,
  onClick,
  label,
  price,
  sub,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  price: string;
  sub: string;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex-1 text-left transition-all"
      style={{
        borderRadius: 12,
        padding: "8px 10px",
        border: `1.5px solid ${active ? "var(--lingo-accent-end)" : "var(--lingo-border)"}`,
        background: active ? "var(--lingo-accent-tint)" : "#fff",
      }}
    >
      {badge && (
        <span
          className="absolute -top-1.5 right-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white"
          style={{ background: "var(--lingo-blue)" }}
        >
          {badge}
        </span>
      )}
      <div className="flex items-center justify-between gap-1">
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--lingo-text-muted)",
          }}
        >
          {label}
        </span>
        {active && <Check size={12} style={{ color: "var(--lingo-accent-end)" }} />}
      </div>
      <div className="lingo-display" style={{ fontSize: 16, color: "var(--lingo-navy)", marginTop: 2 }}>
        {price}
      </div>
      <div style={{ fontSize: 10, color: "var(--lingo-text-muted)" }}>{sub}</div>
    </button>
  );
}
