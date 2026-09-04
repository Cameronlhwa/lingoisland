"use client";

import Link from "next/link";

type NightCtaLink = { href: string; label: string };

/**
 * Contained illustrated night CTA panel (OnePrep-style bottom CTA).
 * Shared by / and /hskprep — pass copy + links per product track.
 */
export default function HSKNightCTA({
  title = "Ready to find your HSK level?",
  subtitle = "Take a quick level check and get a Topic Island built around you.",
  primary = { href: "/onboarding/hsk", label: "Start My HSK Journey" },
  secondary = { href: "/#topics", label: "Explore Topics" },
}: {
  title?: string;
  subtitle?: string;
  primary?: NightCtaLink;
  secondary?: NightCtaLink;
}) {
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
