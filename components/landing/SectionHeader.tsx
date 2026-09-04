import type { ReactNode } from "react";

/** Consistent eyebrow + navy heading + muted subtitle pattern used across HSK landing sections. */
export default function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "center" | "left";
}) {
  return (
    <div
      style={{
        textAlign: align,
        marginBottom: 48,
        maxWidth: align === "center" ? 620 : undefined,
        marginLeft: align === "center" ? "auto" : undefined,
        marginRight: align === "center" ? "auto" : undefined,
      }}
    >
      {eyebrow && (
        <span
          style={{
            display: "inline-block",
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--lingo-teal)",
            background: "var(--lingo-accent-tint)",
            border: "1px solid var(--lingo-accent-border)",
            borderRadius: 999,
            padding: "5px 14px",
            marginBottom: 16,
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          {eyebrow}
        </span>
      )}
      <h2
        className="lingo-display"
        style={{
          fontSize: 34,
          fontWeight: 700,
          color: "var(--lingo-navy)",
          lineHeight: 1.15,
          marginBottom: subtitle ? 14 : 0,
        }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          style={{
            fontFamily: "'DM Sans', system-ui, sans-serif",
            fontSize: 17,
            color: "var(--lingo-text-muted)",
            lineHeight: 1.65,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
