"use client";

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Check, ChevronLeft } from "lucide-react";
import AppLogo from "@/components/app/AppLogo";
import { HSK_BTN_GRADIENT, HSK_BTN_SHADOW, HSK_CARD_SHADOW } from "@/lib/glossy-theme";

export const NAVY = "#5F3119";
export const GREEN = "#20674F";
/** Darker than the legacy #5A7A90 so small text clears WCAG AA on white. */
export const MUTED = "#4F6E83";
export const CARD_BORDER = "#C2DCF0";
export const SKY_PALE = "#F4FAFD";
export const FONT_BODY = "'DM Sans', system-ui, sans-serif";
export const FONT_DISPLAY = "var(--font-home-display), Nunito, system-ui, sans-serif";

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener?.("change", listener);
    return () => query.removeEventListener?.("change", listener);
  }, []);
  return reduced;
}

export function Shell({ children, wide = false }: { children: ReactNode; wide?: boolean | "xl" }) {
  return (
    <div
      className="relative flex min-h-[100dvh] flex-col items-center overflow-x-hidden px-3 py-6 sm:px-4 sm:py-10"
      style={{ fontFamily: FONT_BODY, background: "#EAF6FB" }}
    >
      <div
        aria-hidden
        className="hsk-onboarding-bg pointer-events-none fixed inset-0"
        style={{ backgroundImage: "url(/onboarding/journey-bg.png)", backgroundSize: "cover", backgroundRepeat: "no-repeat" }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 38%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.22) 45%, transparent 72%)",
        }}
      />
      <div className="relative z-10 flex w-full flex-col items-center">
        <div className="mb-4 sm:mb-6">
          <AppLogo />
        </div>
        <main
          id="onboarding-main"
          className={`w-full rounded-3xl bg-white p-5 sm:p-8 ${wide === "xl" ? "max-w-xl md:max-w-4xl" : wide ? "max-w-2xl" : "max-w-xl"}`}
          style={{ boxShadow: HSK_CARD_SHADOW }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

/** Polite live region for feedback and progress announcements. */
export function LiveRegion({ message }: { message: string }) {
  return (
    <p aria-live="polite" role="status" className="sr-only">
      {message}
    </p>
  );
}

export function ProgressBar({ index, total }: { index: number; total: number }) {
  const percent = Math.round((index / Math.max(1, total)) * 100);
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label="Onboarding progress"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={index}
        aria-valuetext={`Step ${index} of ${total}`}
        className="h-1.5 flex-1 overflow-hidden rounded-full"
        style={{ background: "rgba(194, 220, 240, 0.9)" }}
      >
        <div
          className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500"
          style={{ width: `${percent}%`, background: GREEN }}
        />
      </div>
      <span className="shrink-0 text-xs font-medium tabular-nums" style={{ color: MUTED }}>
        {index} of {total}
      </span>
    </div>
  );
}

/**
 * Standard step layout. The heading takes focus on mount so keyboard and
 * screen reader users land on the new question.
 */
export function StepFrame({
  title,
  subtitle,
  progress,
  onBack,
  children,
  eyebrow,
  titleId,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  progress?: { index: number; total: number };
  onBack?: (() => void) | null;
  children: ReactNode;
  eyebrow?: ReactNode;
  titleId?: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: false });
  }, []);
  return (
    <section aria-labelledby={titleId ?? "onboarding-step-title"}>
      <div className="flex items-center gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-0.5 rounded-full pr-2 text-sm font-semibold hover:bg-[#F4FAFD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ color: NAVY, outlineColor: GREEN }}
          >
            <ChevronLeft size={18} aria-hidden />
            Back
          </button>
        ) : null}
        {progress ? (
          <div className="flex-1">
            <ProgressBar index={progress.index} total={progress.total} />
          </div>
        ) : null}
      </div>
      {eyebrow ? (
        <p className="mt-5 text-xs font-bold uppercase tracking-wide" style={{ color: GREEN }}>
          {eyebrow}
        </p>
      ) : null}
      <h1
        id={titleId ?? "onboarding-step-title"}
        ref={headingRef}
        tabIndex={-1}
        className={`${eyebrow ? "mt-1.5" : "mt-5"} text-[22px] font-bold leading-tight outline-none sm:text-[26px]`}
        style={{ fontFamily: FONT_DISPLAY, color: NAVY }}
      >
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-[15px] leading-relaxed" style={{ color: MUTED }}>
          {subtitle}
        </p>
      ) : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function PrimaryButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-[15px] font-semibold text-white transition-all motion-safe:hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:disabled:hover:translate-y-0 ${className}`}
      style={{ background: HSK_BTN_GRADIENT, boxShadow: HSK_BTN_SHADOW, outlineColor: GREEN, ...props.style }}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border bg-white px-6 py-3 text-[15px] font-semibold transition-colors hover:bg-[#F4FAFD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={{ borderColor: CARD_BORDER, color: NAVY, outlineColor: GREEN, ...props.style }}
    >
      {children}
    </button>
  );
}

export function TextButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`mx-auto flex min-h-[44px] items-center justify-center px-3 text-sm font-semibold underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 ${className}`}
      style={{ color: MUTED, outlineColor: GREEN, ...props.style }}
    >
      {children}
    </button>
  );
}

/** Selected state is shown with a check mark and a thicker border, never color alone. */
export function OptionCard({
  selected,
  onSelect,
  title,
  description,
  badge,
  disabled,
  lang,
  testId,
  compact = false,
}: {
  selected: boolean;
  onSelect: () => void;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  lang?: string;
  testId?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      data-testid={testId}
      lang={lang}
      className={`flex w-full min-h-[48px] items-center gap-3 rounded-2xl bg-white text-left transition-colors hover:bg-[#F4FAFD] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${compact ? "px-3.5 py-2.5" : "p-4"}`}
      style={{
        border: `1px solid ${selected ? GREEN : CARD_BORDER}`,
        boxShadow: selected ? `inset 0 0 0 1px ${GREEN}` : undefined,
        background: selected ? "rgba(32,103,79,0.06)" : "#fff",
        outlineColor: GREEN,
      }}
    >
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border"
        style={{ borderColor: selected ? GREEN : CARD_BORDER, background: selected ? GREEN : "#fff" }}
      >
        {selected ? <Check size={14} strokeWidth={3} color="#fff" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-semibold leading-snug" style={{ color: NAVY }}>
            {title}
          </span>
          {badge ? (
            <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "rgba(32,103,79,0.1)", color: GREEN }}>
              {badge}
            </span>
          ) : null}
        </span>
        {description ? (
          <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: MUTED }}>
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function ChipButton({
  selected,
  onToggle,
  children,
  testId,
}: {
  /** Omit for action chips (quick replies) that have no on/off state. */
  selected?: boolean;
  onToggle: () => void;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected === undefined ? undefined : selected}
      onClick={onToggle}
      data-testid={testId}
      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      style={{
        border: `1px solid ${selected ? GREEN : CARD_BORDER}`,
        boxShadow: selected ? `inset 0 0 0 1px ${GREEN}` : undefined,
        background: selected ? "rgba(32,103,79,0.08)" : "#fff",
        color: selected ? GREEN : NAVY,
        outlineColor: GREEN,
      }}
    >
      {selected ? <Check size={15} strokeWidth={3} aria-hidden /> : null}
      {children}
    </button>
  );
}

export function FieldError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-2 rounded-lg px-3 py-2 text-sm" style={{ background: "#FFF6E5", color: "#7A4B00" }}>
      {message}
    </p>
  );
}

export function SectionLabel({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="text-[15px] font-bold" style={{ color: NAVY }}>
      {children}
    </h2>
  );
}
