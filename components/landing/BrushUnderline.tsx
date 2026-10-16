import type { ReactNode } from "react";

/**
 * Emphasis underline for key phrases — a clean straight rule (OnePrep-style),
 * not a hand-drawn squiggle. Color is the LingoIsland accent, kept simple so
 * it reads as premium/confident rather than playful.
 */
export default function BrushUnderline({
  children,
  color = "var(--lingo-blue)",
  thickness = 4,
  variant = "rule",
}: {
  children: ReactNode;
  color?: string;
  thickness?: number;
  /** Straight rule everywhere; hand-drawn stroke is opt-in for the homepage hero. */
  variant?: "rule" | "brush";
}) {
  if (variant === "brush") {
    return (
      <span className="lingo-brush" style={{ color }}>
        {children}
        <svg className="lingo-brush-line" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden>
          <path
            d="M2 2.5 C 22 6.5, 78 6.5, 98 2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </span>
    );
  }

  return (
    <span
      style={{
        textDecoration: "underline",
        textDecorationColor: color,
        textDecorationThickness: thickness,
        textUnderlineOffset: "0.14em",
      }}
    >
      {children}
    </span>
  );
}
