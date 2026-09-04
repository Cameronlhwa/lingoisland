import type { ReactNode } from "react";
import { LINGO_ACCENT_GRADIENT, LINGO_ACCENT_SHADOW } from "@/lib/glossy-theme";

/**
 * Small polished icon "object" — an irregular extra-rounded tile with an
 * inner gloss highlight, standing in for the square gradient SaaS icon box.
 * Meant to read as a tiny artifact from the same illustrated world as the
 * hero, not a generic UI icon container.
 */
export default function IconBadge({
  children,
  size = 56,
}: {
  children: ReactNode;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "18px 22px 17px 21px",
        background: LINGO_ACCENT_GRADIENT,
        boxShadow: LINGO_ACCENT_SHADOW,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        color: "#fff",
        transition: "transform 0.25s ease",
      }}
    >
      {children}
    </div>
  );
}
