"use client";

import Image from "next/image";
import {
  MessageCircle,
  Mic,
  Star,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { HSK_BTN_GRADIENT, HSK_BTN_SHADOW } from "@/lib/glossy-theme";

const BROWN = "#5F3119";
const MUTED_BLUE = "#5A7A90";
const GREEN = "#20674F";
// Matches the pale sky just above the illustration's horizon so the headline
// band blends into the image.
const SKY = "#DDF1FC";

export type PaywallPlanPricing = Record<
  "monthly" | "yearly",
  { price: string; note: string }
>;

const BENEFITS: {
  icon: LucideIcon;
  label: string;
  color: string;
  tint: string;
}[] = [
  {
    icon: MessageCircle,
    label: "Speak with more confidence",
    color: GREEN,
    tint: "rgba(32,103,79,0.10)",
  },
  {
    icon: Target,
    label: "Lessons built around your goals",
    color: "#D9735A",
    tint: "rgba(217,115,90,0.12)",
  },
  {
    icon: TrendingUp,
    label: "Keep learning consistently",
    color: "#1F9E92",
    tint: "rgba(43,187,173,0.14)",
  },
];

interface MobileJourneyUpgradeModalProps {
  lessons: { name: string; zh: string | null }[];
  billingInterval: "yearly" | "monthly";
  onBillingIntervalChange: (interval: "yearly" | "monthly") => void;
  onProceedCheckout: () => void;
  checkoutLoading: boolean;
  checkoutError: string | null;
  pricing: PaywallPlanPricing;
  fullPage: boolean;
}

/** Below-md presentation of OnboardingPaywall; all state lives in the parent. */
export default function MobileJourneyUpgradeModal({
  lessons,
  billingInterval,
  onBillingIntervalChange,
  onProceedCheckout,
  checkoutLoading,
  checkoutError,
  pricing,
  fullPage,
}: MobileJourneyUpgradeModalProps) {
  const selected = pricing[billingInterval];
  const lessonHeading =
    lessons.length === 1
      ? "Your first lesson"
      : `Your first ${lessons.length} lessons`;

  const planOption = (interval: "monthly" | "yearly", label: string) => {
    const active = billingInterval === interval;
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => onBillingIntervalChange(interval)}
        className="min-h-[44px] flex-1 rounded-xl px-2 py-2 text-center text-[13px] font-semibold transition-colors"
        style={{
          border: active ? `2px solid ${GREEN}` : "1px solid #DCE3E8",
          background: active ? "rgba(32,103,79,0.07)" : "#fff",
          color: active ? GREEN : BROWN,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className={
        fullPage
          ? "relative flex min-h-[100dvh] flex-col md:hidden"
          : "fixed inset-0 z-50 flex flex-col overflow-y-auto md:hidden"
      }
      style={{
        background: SKY,
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <section className="relative shrink-0">
        <div className="relative z-10 px-6 pt-[max(1.25rem,env(safe-area-inset-top))] text-center">
          <p className="text-[12px] font-bold" style={{ color: GREEN }}>
            Your personalized plan is ready
          </p>
          <h1
            className="lingo-display mx-auto mt-1.5 max-w-[22rem]"
            style={{
              fontSize: "clamp(26px, 7.4vw, 32px)",
              lineHeight: 1.12,
              color: BROWN,
            }}
          >
            Turn your interests into real conversations
          </h1>
          <p
            className="mx-auto mt-1.5 max-w-[20rem] text-[14px] leading-snug"
            style={{ color: MUTED_BLUE }}
          >
            Learn the words and phrases you&apos;ll actually use.
          </p>
        </div>

        {/* Square art, cropped top/bottom only; the capybara sits ~40–66% down. */}
        <div className="relative -mt-[12vw] aspect-[16/10] max-h-[32svh] w-full overflow-hidden">
          <Image
            src="/onboarding/upgrade-hero-capybara-cliff.webp"
            alt="A capybara with a green backpack looking out over a tropical bay"
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: "50% 55%" }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[38%]"
            style={{
              background: `linear-gradient(to bottom, ${SKY} 15%, rgba(221,241,252,0))`,
            }}
          />
        </div>
      </section>

      <section
        className="relative z-10 -mt-6 flex-1 shrink-0 rounded-t-[26px] bg-white px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        style={{ boxShadow: "0 -10px 30px -18px rgba(7,30,46,0.35)" }}
      >
        <h2 className="text-[15px] font-bold" style={{ color: BROWN }}>
          {lessonHeading}
        </h2>
        <ol className="mt-2 flex flex-col gap-1">
          {lessons.map((lesson, idx) => (
            <li
              key={`${lesson.name}-${idx}`}
              className="flex items-center gap-3 rounded-xl px-3 py-1.5"
              style={{ background: "#FBF7F0" }}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: GREEN }}
              >
                {String(idx + 1).padStart(2, "0")}
              </span>
              <span
                className="line-clamp-2 min-w-0 flex-1 text-[14px] font-semibold leading-snug"
                style={{ color: BROWN }}
              >
                {lesson.name}
              </span>
            </li>
          ))}
          <li
            className="flex items-center gap-3 rounded-xl px-3 py-1.5"
            style={{ background: "rgba(217,115,90,0.09)" }}
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: "#D9735A" }}
            >
              <Mic size={13} strokeWidth={2.4} aria-hidden />
            </span>
            <span
              className="min-w-0 flex-1 text-[14px] font-semibold leading-snug"
              style={{ color: BROWN }}
            >
              Speaking practice
            </span>
            <span
              className="shrink-0 text-[12px]"
              style={{ color: MUTED_BLUE }}
            >
              Tone and pronunciation help
            </span>
          </li>
        </ol>

        <ul className="mt-3 grid grid-cols-3 gap-2">
          {BENEFITS.map(({ icon: Icon, label, color, tint }) => (
            <li key={label} className="flex flex-col items-center text-center">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{ background: tint }}
              >
                <Icon
                  size={16}
                  strokeWidth={2.2}
                  style={{ color }}
                  aria-hidden
                />
              </span>
              <span
                className="mt-1 text-[12px] font-medium leading-tight"
                style={{ color: BROWN }}
              >
                {label}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex gap-2">
          {planOption("monthly", "Monthly")}
          {planOption("yearly", "Annual · best value")}
        </div>

        <p className="mt-2.5 text-center" style={{ color: BROWN }}>
          <span className="lingo-display text-[28px] leading-none">
            {selected.price}
          </span>
          <span className="ml-1 text-[14px]" style={{ color: MUTED_BLUE }}>
            /mo
          </span>
        </p>

        {checkoutError && (
          <p className="mt-2 text-center text-xs text-red-600">
            {checkoutError}
          </p>
        )}

        <button
          type="button"
          className="mt-2.5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-bold text-white transition-all disabled:opacity-60"
          style={{ background: HSK_BTN_GRADIENT, boxShadow: HSK_BTN_SHADOW }}
          disabled={checkoutLoading}
          onClick={onProceedCheckout}
        >
          {checkoutLoading ? "Starting checkout…" : "Start my Mandarin plan →"}
        </button>
        <p
          className="mt-1.5 text-center text-[12px]"
          style={{ color: MUTED_BLUE }}
        >
          {selected.note}
        </p>

        <figure
          className="mt-5 rounded-2xl border px-4 py-3.5"
          style={{
            borderColor: "rgba(33,118,174,0.14)",
            background: "#FBF7F0",
          }}
        >
          <div
            className="flex gap-0.5"
            role="img"
            aria-label="5 out of 5 stars"
          >
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                size={15}
                fill="#F5B83D"
                strokeWidth={0}
                aria-hidden
              />
            ))}
          </div>
          <blockquote
            className="mt-2 text-[13px] italic leading-relaxed"
            style={{ color: BROWN }}
          >
            “LingoIsland transformed how I learned Mandarin by personalizing
            lessons around what I actually needed, not textbook scenarios like
            opening a bank account in China.”
          </blockquote>
          <figcaption className="mt-3 flex items-center gap-2.5">
            <Image
              src="/founder/cameron-lim-profile.jpg"
              alt="Cameron Lim"
              width={36}
              height={36}
              className="shrink-0 rounded-full border-2 border-white object-cover"
            />
            <div className="min-w-0">
              <p className="text-[13px] font-bold" style={{ color: GREEN }}>
                Cameron Lim
              </p>
              <p
                className="text-[12px] leading-snug"
                style={{ color: MUTED_BLUE }}
              >
                Content creator · 125K+ YouTube subscribers
              </p>
            </div>
          </figcaption>
        </figure>
        <p
          className="mt-2.5 px-2 text-center text-[12px] leading-snug"
          style={{ color: MUTED_BLUE }}
        >
          LingoIsland was designed by a teacher certified with the CTCSOL, the
          international certificate for teaching Chinese to speakers of other
          languages.
        </p>
      </section>
    </div>
  );
}
