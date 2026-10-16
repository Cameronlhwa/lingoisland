import type { ReactNode } from "react";

/** Small green icon tile from the homepage. */
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
        background: "var(--lingo-icon-bg)",
        boxShadow: "var(--lingo-icon-shadow)",
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
