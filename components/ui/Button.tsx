"use client";

import Link from "next/link";
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

const PRIMARY_SHADOW = "var(--lingo-btn-shadow)";
const PRIMARY_HOVER_SHADOW = "var(--lingo-btn-shadow-hover)";

export type ButtonProps = {
  href?: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  size?: "default" | "compact";
  style?: CSSProperties;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  disabled?: boolean;
  type?: "button" | "submit";
  /** Homepage only: fade into /onboarding/journey. */
  journeyTransition?: boolean;
};

export default function Button({
  href,
  children,
  variant = "primary",
  size = "default",
  style,
  className = "",
  onClick,
  disabled,
  type = "button",
  journeyTransition = false,
}: ButtonProps) {
  const compact = size === "compact";
  const primary = variant === "primary";
  const sharedClass = `group inline-flex items-center justify-center gap-2 whitespace-nowrap no-underline transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${
    primary ? "text-white hover:scale-[1.015] active:scale-[0.99] disabled:hover:scale-100" : ""
  } ${className}`;
  const sharedStyle: CSSProperties = primary
    ? {
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontWeight: 700,
        fontSize: compact ? 13.5 : 15,
        borderRadius: "var(--lingo-btn-radius)",
        padding: compact ? "10px 20px" : "16px 28px",
        background: "var(--lingo-btn-bg)",
        boxShadow: PRIMARY_SHADOW,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }
    : {
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontWeight: 700,
        fontSize: compact ? 13.5 : 15,
        color: "var(--lingo-navy)",
        borderRadius: "var(--lingo-btn-radius)",
        padding: compact ? "10px 20px" : "15px 27px",
        background: "var(--lingo-btn-secondary-bg)",
        border: "var(--lingo-btn-secondary-border)",
        boxShadow: "var(--lingo-btn-secondary-shadow)",
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      };

  const hoverHandlers = primary
    ? {
        onMouseEnter: (e: { currentTarget: HTMLElement }) => {
          if (disabled) return;
          e.currentTarget.style.boxShadow = PRIMARY_HOVER_SHADOW;
        },
        onMouseLeave: (e: { currentTarget: HTMLElement }) => {
          e.currentTarget.style.boxShadow = PRIMARY_SHADOW;
        },
      }
    : {};

  if (href && !disabled) {
    return (
      <Link
        href={href}
        className={sharedClass}
        style={sharedStyle}
        onClick={onClick}
        {...(journeyTransition ? { "data-journey-transition": "" } : {})}
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
