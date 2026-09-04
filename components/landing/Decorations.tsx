import type { CSSProperties } from "react";

/** Low-priority environment decoration — a soft drifting cloud puff. */
export function FloatingCloud({
  style,
  width = 120,
  floatClass = "lingo-float",
}: {
  style?: CSSProperties;
  width?: number;
  floatClass?: "lingo-float" | "lingo-float-slow" | "lingo-float-fast";
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 120 60"
      width={width}
      height={width * 0.5}
      className={floatClass}
      style={{ position: "absolute", pointerEvents: "none", ...style }}
    >
      <ellipse cx="30" cy="38" rx="26" ry="16" fill="#ffffff" opacity="0.55" />
      <ellipse cx="60" cy="30" rx="34" ry="20" fill="#ffffff" opacity="0.6" />
      <ellipse cx="90" cy="38" rx="24" ry="15" fill="#ffffff" opacity="0.5" />
    </svg>
  );
}

/** A single soft four-point sparkle — slow opacity/scale pulse only. */
export function Sparkle({ style, size = 14 }: { style?: CSSProperties; size?: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className="lingo-sparkle"
      style={{ position: "absolute", pointerEvents: "none", ...style }}
    >
      <path d="M12 0 L14 10 L24 12 L14 14 L12 24 L10 14 L0 12 L10 10 Z" fill="#ffffff" />
    </svg>
  );
}

/**
 * Capybara mascot peeking over a card corner — transparent PNG, no badge/circle.
 * Position via `style` (typically top/right) on a `position: relative` card.
 * Does not affect parent layout (absolute + pointer-events none).
 */
export function CapybaraPeek({
  width = 105,
  className,
  style,
}: {
  width?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <img
      src="/capybara-peek-notch.png"
      alt=""
      aria-hidden
      width={width}
      height={Math.round(width * (556 / 659))}
      className={className}
      style={{
        position: "absolute",
        width,
        height: "auto",
        pointerEvents: "none",
        zIndex: 2,
        filter: "drop-shadow(0 6px 14px rgba(44, 105, 128, 0.16))",
        userSelect: "none",
        ...style,
      }}
      draggable={false}
    />
  );
}
