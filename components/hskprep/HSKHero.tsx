"use client";

import type { ReactNode } from "react";
import PrimaryButton from "@/components/landing/PrimaryButton";
import BrushUnderline from "@/components/landing/BrushUnderline";
import { Sparkle, FloatingCloud } from "@/components/landing/Decorations";

/**
 * Full-bleed illustrated hero shared by / and /hskprep.
 * Artwork: four capybaras in the corners with an open sky corridor for copy.
 * Responsive background-position keeps at least one mascot in frame on mobile.
 */
export default function HSKHero({
  backgroundImageUrl = "/hskprep/hero-capybara-fantasy.png",
  title = (
    <>
      HSK prep that&apos;s actually built <BrushUnderline>around you</BrushUnderline>
    </>
  ),
  subtitle = "Pass the HSK with vocabulary that actually sticks — real topics, real sentences, 150+ tests to prove you're ready.",
  ctaHref = "/onboarding/hsk",
  ctaLabel = "Start My HSK Journey",
}: {
  backgroundImageUrl?: string;
  title?: ReactNode;
  subtitle?: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <section
      className="hero-scene"
      style={{ position: "relative", overflow: "hidden" }}
    >
      <div
        aria-hidden
        className="hero-scene-bg"
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${backgroundImageUrl})`,
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      />

      <Sparkle style={{ top: "14%", right: "18%" }} size={16} />
      <Sparkle style={{ top: "68%", left: "12%" }} size={12} />
      <FloatingCloud style={{ top: "8%", left: "4%" }} width={110} floatClass="lingo-float-slow" />
      <FloatingCloud style={{ top: "16%", right: "6%" }} width={90} floatClass="lingo-float" />

      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          textAlign: "center",
          padding: "24px",
          position: "relative",
          zIndex: 3,
          minHeight: "clamp(560px, 78vh, 780px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: "-40px -10% -20px",
            zIndex: -1,
            background:
              "radial-gradient(ellipse at center, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.14) 42%, transparent 74%)",
            pointerEvents: "none",
          }}
        />

        <h1
          className="hero-headline lingo-display"
          style={{
            fontWeight: 700,
            fontSize: "clamp(36px, 5vw, 56px)",
            lineHeight: 1.02,
            letterSpacing: "-0.035em",
            color: "var(--lingo-navy)",
            marginBottom: 22,
          }}
        >
          {title}
        </h1>

        <p
          className="hero-sub"
          style={{
            fontSize: 17.5,
            color: "var(--lingo-text-muted)",
            lineHeight: 1.65,
            maxWidth: 560,
            margin: "0 auto 32px",
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          {subtitle}
        </p>

        <div
          className="hero-ctas"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <PrimaryButton href={ctaHref}>
            {ctaLabel}
            <span className="inline-block transition-transform duration-200 group-hover:translate-x-[3px]">
              →
            </span>
          </PrimaryButton>
        </div>
      </div>

      <div
        aria-hidden
        style={{
          position: "relative",
          zIndex: 2,
          height: 140,
          marginTop: -80,
          background:
            "linear-gradient(to bottom, rgba(239,249,252,0) 0%, rgba(248,252,253,0.86) 60%, #ffffff 100%)",
        }}
      />
    </section>
  );
}
