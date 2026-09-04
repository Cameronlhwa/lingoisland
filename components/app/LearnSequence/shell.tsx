"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  HSK_CARD_BORDER,
  HSK_CARD_SHADOW,
} from "@/lib/glossy-theme";

/** Same card language as HskHomeDashboard FeatureCard / JourneyCard. */
export const LEARN_CARD_CLASS = "w-full rounded-2xl bg-white p-5 sm:p-6";

export const LEARN_CARD_STYLE: CSSProperties = {
  boxShadow: HSK_CARD_SHADOW,
  border: HSK_CARD_BORDER,
};

export function LearnSequenceCard({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`${LEARN_CARD_CLASS} ${className}`}
      style={{ ...LEARN_CARD_STYLE, ...style }}
    >
      {children}
    </div>
  );
}

export function LearnEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-teal)]">
      {children}
    </p>
  );
}

export function HskAppChip({
  children,
  active = false,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold ${
        active
          ? "border-transparent bg-[var(--lingo-navy)] text-white"
          : "border-[var(--lingo-accent-border)] bg-[var(--lingo-sky-pale)] text-[var(--lingo-navy)]"
      }`}
    >
      {children}
    </span>
  );
}

export function GlossyProgressBar({
  active,
  total,
}: {
  active: number;
  total: number;
}) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="h-1.5 flex-1 rounded-full"
          style={{
            background:
              i <= active ? "var(--lingo-blue)" : "var(--lingo-sky)",
          }}
        />
      ))}
    </div>
  );
}
