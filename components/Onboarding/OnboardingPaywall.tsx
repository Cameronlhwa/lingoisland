"use client";

import { useMemo } from "react";
import Image from "next/image";
import {
  AudioLines,
  BarChart3,
  BookOpen,
  Briefcase,
  Clapperboard,
  Check,
  Dumbbell,
  Gamepad2,
  House,
  Infinity as InfinityIcon,
  Landmark,
  MessagesSquare,
  Music,
  Plane,
  Route,
  Sparkles,
  Users,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { cefrToHsk, hskLabelForCefr } from "@/lib/levelBands";
import Button from "@/components/ui/Button";
import ConversationPaywall from "./ConversationPaywall";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import LearningPaceChart from "@/components/Onboarding/LearningPaceChart";
import MobileJourneyUpgradeModal, {
  type PaywallPlanPricing,
} from "@/components/Onboarding/MobileJourneyUpgradeModal";

const PLAN_PRICING: PaywallPlanPricing = {
  monthly: { price: "$9.99", note: "Cancel anytime" },
  yearly: { price: "$6.67", note: "$79.99 billed yearly" },
};

const MUTED = "#5A7A90";
const BLUE = "#2176AE";

const PERSONAL_NOTES = {
  beginner:
    "When I first started Mandarin, I spent so much time memorizing random words, but barely knew how to use them. Learning through topics I actually cared about made studying so much more enjoyable, and the words finally started sticking.",
  intermediate:
    "The most frustrating part of learning Mandarin was realizing I could talk about some things, but completely freeze when the topic changed. Practicing conversations around my own interests helped me fill those gaps and feel much more confident speaking.",
  advanced:
    "Even after learning thousands of Chinese words, I still struggled to express myself naturally on certain topics. I've found that focusing on subjects I genuinely care about, then actually practicing conversations, makes such a difference.",
} as const;

/** Missing or unrecognised levels map to HSK 4 via cefrToHsk, i.e. the intermediate note. */
function personalNoteForLevel(cefr: string | null | undefined): string {
  const hsk = cefrToHsk(cefr);
  if (hsk <= 2) return PERSONAL_NOTES.beginner;
  if (hsk <= 4) return PERSONAL_NOTES.intermediate;
  return PERSONAL_NOTES.advanced;
}

const CHIP_ICONS: [RegExp, LucideIcon][] = [
  [/food|restaurant|eat|cook|drink/i, UtensilsCrossed],
  [/music|concert|song|live/i, Music],
  [/travel|trip|city|explore/i, Plane],
  [/friend|social|dating|relationship/i, Users],
  [/film|tv|movie|show|stor/i, Clapperboard],
  [/fitness|sport|gym|outdoor/i, Dumbbell],
  [/game|tech/i, Gamepad2],
  [/family|home|heritage/i, House],
  [/work|business|office|career/i, Briefcase],
  [/culture|history|art/i, Landmark],
  [/school|universit|study|class/i, BookOpen],
];
const CHIP_COLORS = [
  "var(--lingo-accent)",
  BLUE,
  "#8A5CC2",
  "var(--lingo-teal)",
  "#D9735A",
];

function chipIcon(label: string): LucideIcon {
  return CHIP_ICONS.find(([re]) => re.test(label))?.[1] ?? Sparkles;
}

const BENEFITS: {
  icon: LucideIcon;
  title: string;
  detail: string;
  color: string;
  tint: string;
}[] = [
  {
    icon: InfinityIcon,
    title: "Unlimited lessons",
    detail: "Any topic, any time",
    color: "var(--lingo-teal)",
    tint: "rgba(32,103,79,0.10)",
  },
  {
    icon: MessagesSquare,
    title: "Real conversations",
    detail: "Gentle feedback as you speak",
    color: BLUE,
    tint: "rgba(33,118,174,0.10)",
  },
  {
    icon: AudioLines,
    title: "Pronunciation & tone coaching",
    detail: "Hear exactly which tones to fix — and nail them",
    color: "#D9735A",
    tint: "rgba(217,115,90,0.12)",
  },
  {
    icon: BarChart3,
    title: "Built for your interests",
    detail: "Learn vocabulary you'll actually use",
    color: "var(--lingo-accent)",
    tint: "var(--lingo-accent-tint)",
  },
];

/** Frames the paywall as activating a plan the learner already built. */
export type PaywallActivation = {
  presentation?: "conversation";
  illustration?: string;
  levelNote?: string;
  eyebrow: string;
  headline: string;
  subline: string;
  /** Compact pace callout shown on the conversation paywall. */
  highlight?: { title: string; detail: string };
  /** LingoIsland vs typical-apps progress comparison. */
  comparison?: { title: string; weeks: number; lingoLabel?: string; otherLabel?: string };
  desktopEyebrow?: string;
  desktopHeadline?: string;
  desktopSubline?: string;
  desktopBenefits?: ReadonlyArray<string>;
  benefits: ReadonlyArray<{ title: string; detail: string }>;
  cta: string;
  savedNote: string;
  notNowLabel?: string;
  /** X close: leave the offer (usually home). Falls back to onNotNow when omitted. */
  onClose?: () => void;
  onNotNow?: () => void;
  /** A real learner review matched to this learner; replaces the founder quote. */
  review?: { quote: string; role: string } | null;
  /** Shows the speaking-practice row only when the learner tried pronunciation. */
  showSpeakingPractice?: boolean;
  /** "Today -> by week N" bar, the same gap the reflection screen draws. */
  gap?: { fromLabel: string; from: string; toLabel: string; to: string };
  /** Plain-language level chip (e.g. "Starting from scratch") instead of an HSK label. */
  levelChip?: string;
};

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
  interests?: string[];
  daysPerWeek?: number;
  timeLabel?: string;
  billingInterval: "yearly" | "monthly";
  onBillingIntervalChange: (interval: "yearly" | "monthly") => void;
  onProceedCheckout: () => void;
  checkoutLoading?: boolean;
  checkoutError?: string | null;
  fullPage?: boolean;
  activation?: PaywallActivation;
}

export default function OnboardingPaywall({
  topic,
  journeyTopic,
  islandLevel = "B1",
  islandName,
  wordsPerWeek,
  lockedIslands = [],
  motivationLabel,
  interests,
  daysPerWeek,
  timeLabel,
  billingInterval,
  onBillingIntervalChange,
  onProceedCheckout,
  checkoutLoading = false,
  checkoutError = null,
  fullPage = false,
  activation,
}: OnboardingPaywallProps) {
  const displayJourneyTitle = journeyTopic || topic;
  const levelChip = hskLabelForCefr(islandLevel) || islandLevel;
  const selectedPlan = PLAN_PRICING[billingInterval];

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

  const interestChips = useMemo(() => {
    const source = interests?.length
      ? interests
      : motivationLabel
        ? [motivationLabel.split(" · ")[0]]
        : [];
    const seen = new Set<string>();
    const chips: string[] = [];
    for (const raw of [...source, displayJourneyTitle]) {
      const label = raw?.trim();
      if (!label || seen.has(label.toLowerCase())) continue;
      seen.add(label.toLowerCase());
      chips.push(label);
    }
    return chips.slice(0, 5);
  }, [interests, motivationLabel, displayJourneyTitle]);

  const lessonHeading =
    previewUnits.length === 1
      ? "Your first lesson"
      : `Your first ${previewUnits.length} lessons`;

  const compactGoalLabel =
    motivationLabel?.split(" · ")[0] ?? interestChips[0] ?? "Personalized";
  const compactBenefits =
    activation?.desktopBenefits ?? activation?.benefits.slice(0, 3).map((benefit) => benefit.title) ?? [];
  const planButton = (interval: "monthly" | "yearly", label: string) => {
    const active = billingInterval === interval;
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => onBillingIntervalChange(interval)}
        className="flex-1 px-3 py-2.5 text-center text-[13px] font-semibold transition-colors"
        style={{
          borderRadius: "var(--lingo-radius-control)",
          border: active
            ? "1.5px solid var(--lingo-teal)"
            : "1px solid var(--lingo-border)",
          background: active ? "rgba(32,103,79,0.06)" : "var(--lingo-white)",
          color: active ? "var(--lingo-teal)" : "var(--lingo-navy)",
        }}
      >
        {label}
      </button>
    );
  };

  if (activation?.presentation === "conversation") {
    return (
      <ConversationPaywall
        activation={activation}
        pricing={PLAN_PRICING}
        billingInterval={billingInterval}
        onBillingIntervalChange={onBillingIntervalChange}
        fullPage={fullPage}
        checkoutLoading={checkoutLoading}
        checkoutError={checkoutError}
        onProceedCheckout={onProceedCheckout}
      />
    );
  }

  return (
    <>
      <MobileJourneyUpgradeModal
        lessons={previewUnits}
        billingInterval={billingInterval}
        onBillingIntervalChange={onBillingIntervalChange}
        onProceedCheckout={onProceedCheckout}
        checkoutLoading={checkoutLoading}
        checkoutError={checkoutError}
        pricing={PLAN_PRICING}
        fullPage={fullPage}
        activation={activation}
      />
      <div
        className={
          fullPage
            ? "relative hidden min-h-screen items-center justify-center overflow-y-auto p-4 sm:p-6 md:flex"
            : "fixed inset-0 z-50 hidden items-center justify-center overflow-y-auto p-4 sm:p-6 md:flex"
        }
        style={{
          background: "#EAF6FB",
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        <div
          aria-hidden
          className="hsk-onboarding-bg pointer-events-none fixed inset-0"
          style={{
            backgroundImage: "url(/onboarding/journey-bg.png)",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% 38%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.22) 45%, transparent 72%)",
          }}
        />
        {activation ? (
          <Card
            hover={false}
            padded={false}
            className="relative z-10 my-auto w-full max-w-[760px] overflow-hidden"
            style={{
              borderRadius: 28,
              boxShadow:
                "0 22px 54px -24px rgba(7,30,46,0.38), 0 2px 8px rgba(33,118,174,0.08)",
            }}
          >
            <div className="px-8 py-8 text-center lg:px-14 lg:py-10">
              <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--lingo-teal)]">
                {activation.desktopEyebrow ?? activation.eyebrow}
              </p>
              <h1
                className="lingo-display mx-auto mt-2 max-w-[620px] text-[var(--lingo-navy)]"
                style={{ fontSize: "clamp(34px, 4vw, 46px)", lineHeight: 1.06 }}
              >
                {activation.desktopHeadline ?? activation.headline}
              </h1>
              <p className="mx-auto mt-3 max-w-[520px] text-[16px] leading-relaxed" style={{ color: MUTED }}>
                {activation.desktopSubline ?? activation.subline}
              </p>

              {activation.gap ? (
                <div className="mx-auto mt-6 grid max-w-[600px] grid-cols-[1fr_auto_1fr] items-stretch gap-2 text-left" data-testid="desktop-paywall-gap">
                  <div className="rounded-2xl px-4 py-3" style={{ background: "rgba(217,115,90,0.08)", border: "1px solid rgba(217,115,90,0.3)" }}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "#B5543C" }}>{activation.gap.fromLabel}</p>
                    <p className="mt-0.5 text-[15px] font-bold leading-snug text-[var(--lingo-navy)]">{activation.gap.from}</p>
                  </div>
                  <div className="flex items-center text-[22px] font-bold text-[var(--lingo-teal)]" aria-hidden>&rarr;</div>
                  <div className="rounded-2xl px-4 py-3" style={{ background: "rgba(32,103,79,0.09)", border: "1px solid rgba(32,103,79,0.3)" }}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--lingo-teal)]">{activation.gap.toLabel}</p>
                    <p className="mt-0.5 text-[15px] font-bold leading-snug text-[var(--lingo-navy)]">{activation.gap.to}</p>
                  </div>
                </div>
              ) : (
              <ol className="mx-auto mt-5 flex max-w-[500px] flex-col gap-2 text-left" aria-label={lessonHeading} data-testid="desktop-paywall-lessons">
                {previewUnits.slice(0, 2).map((unit, index) => (
                  <li
                    key={`${unit.name}-${index}`}
                    className="flex items-center gap-3 rounded-xl px-3 py-2"
                    style={{ background: "#FBF7F0" }}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--lingo-teal)] text-[11px] font-bold text-white">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 text-[15px] font-semibold text-[var(--lingo-navy)]">{unit.name}</span>
                  </li>
                ))}
              </ol>
              )}

              {activation.gap ? null : (
              <ul className="mt-5 flex flex-wrap justify-center gap-2.5" aria-label="Your personalized plan">
                <li>
                  <Chip>
                    <BarChart3 size={14} strokeWidth={2.3} className="text-[var(--lingo-teal)]" aria-hidden />
                    {activation.levelChip ?? levelChip}
                  </Chip>
                </li>
                <li>
                  <Chip>
                    <Briefcase size={14} strokeWidth={2.3} className="text-[var(--lingo-accent)]" aria-hidden />
                    {compactGoalLabel}
                  </Chip>
                </li>
                {daysPerWeek ? (
                  <li>
                    <Chip>
                      <Route size={14} strokeWidth={2.3} className="text-[#2176AE]" aria-hidden />
                      {daysPerWeek} days/week
                    </Chip>
                  </li>
                ) : null}
              </ul>
              )}

              <ul className="mx-auto mt-6 max-w-[500px] space-y-3 text-left" aria-label="Membership benefits">
                {activation.benefits.some((benefit) => benefit.detail)
                  ? activation.benefits.map((benefit) => (
                      <li key={benefit.title} className="flex items-start gap-3 text-[var(--lingo-navy)]">
                        <span
                          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                          style={{ background: "rgba(32,103,79,0.10)" }}
                        >
                          <Check size={16} strokeWidth={2.8} className="text-[var(--lingo-teal)]" aria-hidden />
                        </span>
                        <span>
                          <span className="block text-[15px] font-bold leading-snug">{benefit.title}</span>
                          <span className="block text-[14px] leading-snug" style={{ color: MUTED }}>{benefit.detail}</span>
                        </span>
                      </li>
                    ))
                  : compactBenefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3 text-[15px] font-semibold text-[var(--lingo-navy)]">
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={{ background: "rgba(32,103,79,0.10)" }}
                    >
                      <Check size={16} strokeWidth={2.8} className="text-[var(--lingo-teal)]" aria-hidden />
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>

              <div
                data-testid="desktop-billing-selector"
                className="mx-auto mt-7 flex max-w-[620px] gap-2 rounded-[18px] border p-1.5"
                style={{ borderColor: "var(--lingo-border)", background: "rgba(248,244,237,0.72)" }}
                aria-label="Billing interval"
              >
                {planButton("monthly", "Monthly")}
                {planButton("yearly", "Annual · Save 33%")}
              </div>

              <div
                className="mx-auto mt-3 flex max-w-[620px] items-center justify-between gap-5 rounded-[20px] border px-6 py-5 text-left"
                style={{ borderColor: "var(--lingo-teal)", background: "rgba(32,103,79,0.045)" }}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <p className="lingo-display text-[22px] leading-tight text-[var(--lingo-navy)]">
                      {billingInterval === "yearly" ? "Annual membership" : "Monthly membership"}
                    </p>
                    {billingInterval === "yearly" ? (
                      <span className="rounded-full bg-[var(--lingo-accent)] px-2.5 py-1 text-[11px] font-bold text-white">
                        SAVE 33%
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[13px]" style={{ color: MUTED }}>
                    {selectedPlan.note}
                  </p>
                </div>
                <p className="shrink-0 text-right text-[var(--lingo-navy)]">
                  <span className="lingo-display text-[40px] leading-none">{selectedPlan.price}</span>
                  <span className="ml-1 text-[14px]" style={{ color: MUTED }}>/month</span>
                </p>
              </div>

              {checkoutError ? <p className="mt-4 text-sm text-red-600">{checkoutError}</p> : null}

              <Button
                className="mx-auto mt-6 w-full max-w-[620px]"
                style={{ borderRadius: "var(--lingo-radius-control)", padding: "15px 20px" }}
                disabled={checkoutLoading}
                onClick={onProceedCheckout}
              >
                {checkoutLoading ? "Starting checkout…" : activation.cta}
              </Button>
              <p className="mt-2 text-[12.5px]" style={{ color: MUTED }}>
                Secure payment • Cancel anytime
              </p>
              <div className="mt-3 flex min-h-[44px] items-center justify-center text-[13px] font-semibold">
                {activation.onNotNow ? (
                  <button
                    type="button"
                    onClick={activation.onNotNow}
                    className="px-2 py-2 underline underline-offset-2"
                    style={{ color: MUTED }}
                  >
                    {activation.notNowLabel ?? "Not now"}
                  </button>
                ) : null}
              </div>
              {activation.review ? (
                <figure
                  className="mx-auto mt-4 max-w-[620px] rounded-2xl border px-5 py-4 text-left"
                  style={{ borderColor: "rgba(33,118,174,0.14)", background: "#FBF7F0" }}
                  data-testid="paywall-review"
                >
                  <blockquote className="text-[14px] italic leading-relaxed text-[var(--lingo-navy)]">
                    &ldquo;{activation.review.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-2 text-[13px] font-bold text-[var(--lingo-teal)]">{activation.review.role}</figcaption>
                </figure>
              ) : null}
            </div>
          </Card>
        ) : (
        <Card
          hover={false}
          padded={false}
          className="relative z-10 my-auto w-full max-w-[1040px] overflow-hidden"
          style={{
            boxShadow:
              "0 18px 44px -22px rgba(7,30,46,0.35), 0 1px 4px rgba(33,118,174,0.06)",
          }}
        >
          <div className="grid grid-cols-1 min-[820px]:grid-cols-[11fr_9fr]">
            <div className="px-6 py-6 lg:px-9 lg:py-7">
              <p className="text-[12px] font-bold text-[var(--lingo-teal)]">
                Your personalized plan is ready
              </p>
              <h1
                className="lingo-display mt-2 text-[var(--lingo-navy)]"
                style={{ fontSize: "clamp(28px, 3vw, 36px)", lineHeight: 1.1 }}
              >
                Learn Mandarin through what you love
              </h1>
              <p
                className="mt-2 text-[15px] leading-relaxed"
                style={{ color: MUTED }}
              >
                A personalized path built around your interests and pace.
              </p>

              <ul
                className="mt-3.5 flex flex-wrap gap-2"
                aria-label="Your plan is based on"
              >
                {interestChips.map((label, idx) => {
                  const Icon = chipIcon(label);
                  return (
                    <li key={label} className="max-w-full">
                      <Chip className="max-w-full">
                        <Icon
                          size={14}
                          strokeWidth={2.3}
                          className="shrink-0"
                          style={{
                            color: CHIP_COLORS[idx % CHIP_COLORS.length],
                          }}
                          aria-hidden
                        />
                        <span className="min-w-0 truncate">{label}</span>
                      </Chip>
                    </li>
                  );
                })}
                <li>
                  <Chip>
                    <BarChart3
                      size={14}
                      strokeWidth={2.3}
                      className="shrink-0 text-[var(--lingo-teal)]"
                      aria-hidden
                    />
                    {levelChip}
                  </Chip>
                </li>
              </ul>

              <h2 className="mt-4 text-[15px] font-bold text-[var(--lingo-navy)]">
                {lessonHeading}
              </h2>
              <ol className="mt-2 flex flex-col gap-1.5">
                {previewUnits.map((unit, idx) => (
                  <li
                    key={`${unit.name}-${idx}`}
                    className="flex items-center gap-3 px-3 py-1.5"
                    style={{
                      borderRadius: "var(--lingo-radius-control)",
                      border: "var(--lingo-card-border)",
                      background: "var(--lingo-sky-pale)",
                    }}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ background: "var(--lingo-icon-bg)" }}
                    >
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold leading-tight text-[var(--lingo-navy)]">
                        {unit.name}
                      </span>
                      {unit.zh ? (
                        <span
                          className="mt-0.5 block truncate text-[12px] leading-tight"
                          style={{ color: MUTED }}
                        >
                          {unit.zh}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>

              <LearningPaceChart
                wordsPerWeek={wordsPerWeek}
                daysPerWeek={daysPerWeek}
                timeLabel={timeLabel}
              />
            </div>

            <div
              className="flex flex-col px-6 py-6 lg:px-9 lg:py-7 border-t min-[820px]:border-l min-[820px]:border-t-0"
              style={{ borderColor: "rgba(95,49,25,0.1)" }}
            >
              <div className="flex gap-2">
                {planButton("monthly", "Monthly")}
                {planButton("yearly", "Annual · best value")}
              </div>

              <div className="mt-5">
                <p className="lingo-display text-[44px] leading-none text-[var(--lingo-navy)]">
                  {selectedPlan.price}
                  <span
                    className="ml-1.5 font-sans text-[16px] font-normal"
                    style={{ color: MUTED }}
                  >
                    /mo
                  </span>
                </p>
                <p className="mt-1.5 text-[13px]" style={{ color: MUTED }}>
                  {selectedPlan.note}
                </p>
              </div>

              <ul className="mt-5 space-y-3">
                {BENEFITS.map(({ icon: Icon, title, detail, color, tint }) => (
                  <li key={title} className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      style={{ background: tint }}
                    >
                      <Icon
                        size={19}
                        strokeWidth={2.3}
                        style={{ color }}
                        aria-hidden
                      />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-bold leading-tight text-[var(--lingo-navy)]">
                        {title}
                      </span>
                      <span
                        className="mt-0.5 block text-[12.5px] leading-snug"
                        style={{ color: MUTED }}
                      >
                        {detail}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>

              {checkoutError && (
                <p className="mt-4 text-xs text-red-600">{checkoutError}</p>
              )}

              <Button
                className="mt-6 w-full"
                style={{
                  borderRadius: "var(--lingo-radius-control)",
                  padding: "14px 20px",
                }}
                disabled={checkoutLoading}
                onClick={onProceedCheckout}
              >
                {checkoutLoading
                  ? "Starting checkout…"
                  : "Start my Mandarin plan →"}
              </Button>

              <div aria-hidden className="min-h-6 flex-1" />
              <figure
                className="rounded-2xl px-4 py-3"
                style={{
                  background: "var(--lingo-sky-pale)",
                  border: "var(--lingo-card-border)",
                }}
              >
                <blockquote
                  className="text-[12.5px] italic leading-relaxed"
                  style={{ color: MUTED }}
                >
                  “{personalNoteForLevel(islandLevel)}”
                </blockquote>
                <figcaption className="mt-2.5 flex items-center gap-2">
                  <Image
                    src="/founder/cameron-lim-profile.jpg"
                    alt="Cameron Lim"
                    width={28}
                    height={28}
                    className="shrink-0 rounded-full border-2 border-white object-cover"
                    style={{ boxShadow: "0 2px 6px rgba(33,118,174,0.18)" }}
                    sizes="28px"
                  />
                  <span className="min-w-0 text-[11.5px] leading-snug">
                    <span className="font-bold text-[var(--lingo-teal)]">
                      Cameron
                    </span>
                    <span style={{ color: MUTED }}>
                      {" "}
                      · 125K+ YouTube subscribers
                    </span>
                  </span>
                </figcaption>
              </figure>
              <p
                className="mt-3 text-[11.5px] leading-snug"
                style={{ color: MUTED }}
              >
                LingoIsland was designed by a teacher certified with the CTCSOL,
                the international certificate for teaching Chinese to speakers
                of other languages.
              </p>
            </div>
          </div>
        </Card>
        )}
      </div>
    </>
  );
}
