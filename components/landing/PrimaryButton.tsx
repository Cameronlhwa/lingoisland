"use client";

import Link from "next/link";
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

const BASE_SHADOW =
  "0 12px 28px rgba(21,89,118,0.22), inset 0 1px 0 rgba(255,255,255,0.18)";
const HOVER_SHADOW =
  "0 16px 34px rgba(21,89,118,0.28), inset 0 1px 0 rgba(255,255,255,0.22)";

/**
 * Shared tactile primary CTA — deep navy gradient, glossy top highlight,
 * soft blue-tinted shadow, hover lift, press-down active state. See design
 * tokens in app/globals.css (--lingo-* vars) for the palette this matches.
 */
export default function PrimaryButton({
  href,
  children,
  size = "default",
  style,
  className = "",
  onClick,
  disabled,
  type = "button",
}: {
  href?: string;
  children: ReactNode;
  size?: "default" | "compact";
  style?: CSSProperties;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const compact = size === "compact";
  const sharedClass = `group inline-flex items-center justify-center gap-2 text-white no-underline transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.015] active:translate-y-px active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:scale-100 ${className}`;
  const sharedStyle: CSSProperties = {
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontWeight: 700,
    fontSize: compact ? 13.5 : 15,
    borderRadius: compact ? 14 : 18,
    padding: compact ? "10px 20px" : "16px 28px",
    background: "linear-gradient(180deg, #163F55 0%, #0B2B3C 100%)",
    boxShadow: BASE_SHADOW,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    ...style,
  };

  const hoverHandlers = {
    onMouseEnter: (
      e: { currentTarget: HTMLElement },
    ) => {
      if (disabled) return;
      e.currentTarget.style.boxShadow = HOVER_SHADOW;
    },
    onMouseLeave: (
      e: { currentTarget: HTMLElement },
    ) => {
      e.currentTarget.style.boxShadow = BASE_SHADOW;
    },
  };

  if (href && !disabled) {
    return (
      <Link
        href={href}
        className={sharedClass}
        style={sharedStyle}
        onClick={onClick}
        {...hoverHandlers}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={sharedClass}
      style={sharedStyle}
      onClick={onClick}
      disabled={disabled}
      {...hoverHandlers}
    >
      {children}
    </button>
  );
}
