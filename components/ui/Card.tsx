"use client";

import type { HTMLAttributes, ReactNode } from "react";

const REST_SHADOW = "var(--lingo-card-shadow)";
const HOVER_SHADOW = "var(--lingo-card-shadow-hover)";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  hover?: boolean;
  padded?: boolean;
};

export default function Card({
  children,
  className = "",
  style,
  hover = true,
  padded = true,
  onMouseEnter,
  onMouseLeave,
  ...rest
}: CardProps) {
  return (
    <div
      {...rest}
      className={`${padded ? "p-[26px]" : ""} ${hover ? "transition-all duration-200 hover:-translate-y-0.5" : ""} ${className}`}
      style={{
        borderRadius: "var(--lingo-radius-card)",
        background: "var(--lingo-card-bg)",
        border: "var(--lingo-card-border)",
        boxShadow: REST_SHADOW,
        ...style,
      }}
      onMouseEnter={(event) => {
        if (hover) event.currentTarget.style.boxShadow = HOVER_SHADOW;
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        if (hover) event.currentTarget.style.boxShadow = REST_SHADOW;
        onMouseLeave?.(event);
      }}
    >
      {children}
    </div>
  );
}
