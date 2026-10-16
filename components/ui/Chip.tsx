import type { ReactNode } from "react";

export default function Chip({
  children,
  tone = "default",
  className = "",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "solid";
  className?: string;
}) {
  const toneClass =
    tone === "solid"
      ? "border-transparent bg-[var(--lingo-btn-bg)] text-white"
      : tone === "accent"
        ? "border-[var(--lingo-accent-border)] bg-[var(--lingo-sky-pale)] text-[var(--lingo-navy)]"
        : "border-[var(--lingo-border)] bg-white text-[var(--lingo-navy)]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${toneClass} ${className}`}
    >
      {children}
    </span>
  );
}
