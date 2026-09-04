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
}: {
  children: ReactNode;
  color?: string;
  thickness?: number;
}) {
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
