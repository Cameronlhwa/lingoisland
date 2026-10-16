"use client";

import Link from "next/link";
import BrushUnderline from "@/components/landing/BrushUnderline";

type NightCtaLink = { href: string; label: string };

function WarmHeadline({ title }: { title: string }) {
  const mark = "actually";
  const at = title.indexOf(mark);
  if (at === -1) return <>{title}</>;
  const before = title.slice(0, at);
  const after = title.slice(at + mark.length);
  const split = before.lastIndexOf(" you ");
  const line1 = split > 0 ? before.slice(0, split) : before;
  const line2 = split > 0 ? before.slice(split + 1) : "";
  return (
    <>
      {line1}
      {line2 ? (
        <>
          <br />
          {line2}
        </>
      ) : null}
      <BrushUnderline variant="brush" color="var(--lingo-accent, #EC7D28)">
        {mark}
      </BrushUnderline>
      {after}
    </>
  );
}

function WarmSubtitle({ subtitle }: { subtitle: string }) {
  const lines = subtitle.split(/(?<=\.)\s+/);
  return (
    <>
      {lines.map((line, i) => (
        <span key={line}>
          {i > 0 ? <br /> : null}
          {line}
        </span>
      ))}
    </>
  );
}

function CtaSpark({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      className="home-cta-spark"
      aria-hidden
      width="26"
      height="26"
      viewBox="0 0 26 26"
      style={{ flexShrink: 0, transform: flip ? "scaleX(-1)" : undefined }}
    >
      <path d="M3 13h9" stroke="#F0A04A" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M6 6.5 12 11" stroke="#F0A04A" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M6 19.5 12 15" stroke="#F0A04A" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Contained illustrated night CTA panel (OnePrep-style bottom CTA).
 * Shared by / and /hskprep — pass copy + links per product track.
 */
export default function HSKNightCTA({
  title = "Ready to find your HSK level?",
  subtitle = "Take a quick level check and get a Topic Island built around you.",
  primary = { href: "/onboarding/hsk", label: "Start My HSK Journey" },
  secondary = { href: "/#topics", label: "Explore Topics" },
  appearance = "night",
}: {
  title?: string;
  subtitle?: string;
  primary?: NightCtaLink;
  secondary?: NightCtaLink;
  /** Cream panel for the homepage. Night artwork stays the default. */
  appearance?: "night" | "warm";
}) {
  if (appearance === "warm") {
    return (
      <section className="fade-section" style={{ background: "var(--lingo-page-bg, #fff)", padding: "72px 24px 88px" }}>
        <div className="home-cta-panel">
          <div className="home-cta-copy">
            <div className="home-cta-title-row">
              <CtaSpark />
              <h2
                className="lingo-display"
                style={{
                  color: "var(--lingo-navy)",
                  fontSize: "clamp(30px, 3.6vw, 44px)",
                  fontWeight: 800,
                  lineHeight: 1.12,
                  letterSpacing: "-0.03em",
                  margin: 0,
                }}
              >
                <WarmHeadline title={title} />
              </h2>
              <CtaSpark flip />
            </div>
            <p
              style={{
                color: "var(--lingo-text-muted)",
                fontSize: 16.5,
                lineHeight: 1.55,
                maxWidth: 460,
                margin: "14px auto 22px",
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              <WarmSubtitle subtitle={subtitle} />
            </p>
            <div
              className="hsk-night-cta-buttons"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <Link
                href={primary.href}
                data-journey-transition=""
                className="hover:-translate-y-0.5"
                style={{
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontWeight: 700,
                  fontSize: 15,
                  color: "#fff",
                  background: "var(--lingo-btn-bg, #20674F)",
                  borderRadius: "var(--lingo-btn-radius, 999px)",
                  padding: "13px 24px",
                  textDecoration: "none",
                  boxShadow: "var(--lingo-btn-shadow, none)",
                }}
              >
                {primary.label} →
              </Link>
              <Link
                href={secondary.href}
                className="hover:-translate-y-0.5"
                style={{
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontWeight: 700,
                  fontSize: 15,
                  color: "var(--lingo-teal, #20674F)",
                  background: "#fff",
                  border: "2px solid var(--lingo-teal, #20674F)",
                  borderRadius: "var(--lingo-btn-radius, 999px)",
                  padding: "11px 22px",
                  textDecoration: "none",
                }}
              >
                {secondary.label}
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="fade-section" style={{ background: "#fff", padding: "96px 24px 80px" }}>
      <div
        className="hsk-night-panel"
        style={{
          position: "relative",
          maxWidth: 1160,
          margin: "0 auto",
          borderRadius: 32,
          overflow: "hidden",
          backgroundImage: "url(/hskprep/hsk-night-cta.png)",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 60% 70% at center, rgba(4,10,26,0.4) 0%, rgba(4,10,26,0.14) 45%, transparent 72%)",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 2,
            textAlign: "center",
            padding: "48px 24px",
          }}
        >
          <h2
            className="lingo-display"
            style={{
              color: "#ffffff",
              fontSize: "clamp(32px, 4vw, 46px)",
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              maxWidth: 650,
              margin: "0 auto",
              textShadow: "0 2px 16px rgba(0,0,0,0.25)",
            }}
          >
            {title}
          </h2>
          <p
            style={{
              color: "#cfe6f5",
              fontSize: 17,
              lineHeight: 1.6,
              maxWidth: 550,
              margin: "16px auto 32px",
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            {subtitle}
          </p>

          <div
            className="hsk-night-cta-buttons"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 14,
              flexWrap: "wrap",
            }}
          >
            <Link
              href={primary.href}
              style={{
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontWeight: 700,
                fontSize: 14.5,
                color: "var(--lingo-navy)",
                background: "#ffffff",
                borderRadius: 999,
                padding: "13px 26px",
                textDecoration: "none",
                boxShadow: "0 10px 24px rgba(4,10,26,0.35)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
              className="hover:-translate-y-0.5"
            >
              {primary.label}
            </Link>
            <Link
              href={secondary.href}
              style={{
                fontFamily: "'DM Sans', system-ui, sans-serif",
                fontWeight: 700,
                fontSize: 14.5,
                color: "#ffffff",
                background: "rgba(8,16,36,0.35)",
                border: "1px solid rgba(255,255,255,0.55)",
                borderRadius: 999,
                padding: "12px 25px",
                textDecoration: "none",
                transition: "transform 0.2s ease, background 0.2s ease",
              }}
              className="hover:-translate-y-0.5 hover:bg-[rgba(8,16,36,0.5)]"
            >
              {secondary.label}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
