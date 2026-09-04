"use client";

import Link from "next/link";
import type { CSSProperties, MouseEventHandler, ReactNode } from "react";

/** Softer tactile counterpart to PrimaryButton — pale surface, hairline border, subtle lift. */
export default function SecondaryButton({
  href,
  children,
  style,
  className = "",
  onClick,
  disabled,
  type = "button",
  size = "default",
}: {
  href?: string;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement | HTMLAnchorElement>;
  disabled?: boolean;
  type?: "button" | "submit";
  size?: "default" | "compact";
}) {
  const compact = size === "compact";
  const sharedClass = `group inline-flex items-center justify-center gap-2 no-underline transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${className}`;
  const sharedStyle: CSSProperties = {
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontWeight: 700,
    fontSize: compact ? 13.5 : 15,
    color: "var(--lingo-navy)",
    borderRadius: compact ? 14 : 18,
    padding: compact ? "10px 20px" : "15px 27px",
    background: "rgba(255,255,255,0.75)",
    border: "1px solid rgba(67,146,172,0.18)",
    boxShadow: "0 5px 16px rgba(75,140,164,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
    cursor: disabled ? "not-allowed" : "pointer",
    ...style,
  };

  if (href && !disabled) {
    return (
      <Link href={href} className={sharedClass} style={sharedStyle} onClick={onClick}>
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
    >
      {children}
    </button>
  );
}
