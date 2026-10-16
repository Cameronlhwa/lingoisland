"use client";

import type { ReactNode } from "react";
import Image from "next/image";
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
  showDecorations = true,
  fadeTo,
  priorityImage = false,
  underNav = false,
  journeyTransition = false,
}: {
  backgroundImageUrl?: string;
  title?: ReactNode;
  subtitle?: string;
  ctaHref?: string;
  ctaLabel?: string;
  /** Clouds, sparkles, and the center wash. Off for the homepage illustration. */
  showDecorations?: boolean;
  /** Bottom edge fades into this color. Omit to keep the original white fade. */
  fadeTo?: string;
  /** next/image with priority. Homepage only — other heroes keep the CSS background. */
  priorityImage?: boolean;
  /** Pull the artwork under a transparent sticky nav. */
  underNav?: boolean;
  /** Homepage “Try for free” fades into the journey screen. */
  journeyTransition?: boolean;
}) {
  return (
    <section
      className={underNav ? "hero-scene hero-scene-under-nav" : "hero-scene"}
      style={{ position: "relative", overflow: "hidden" }}
    >
      {priorityImage ? (
        <div aria-hidden className="hero-scene-media">
          <Image
            src={backgroundImageUrl}
            alt=""
            fill
            priority
            quality={90}
            sizes="100vw"
            className="hero-home-img"
          />
        </div>
      ) : (
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
      )}

      {showDecorations && (
        <>
          <Sparkle style={{ top: "14%", right: "18%" }} size={16} />
          <Sparkle style={{ top: "68%", left: "12%" }} size={12} />
          <FloatingCloud style={{ top: "8%", left: "4%" }} width={110} floatClass="lingo-float-slow" />
          <FloatingCloud style={{ top: "16%", right: "6%" }} width={90} floatClass="lingo-float" />
        </>
      )}

      <div
        className={underNav ? "hero-home-copy" : undefined}
        style={
          underNav
            ? {
                maxWidth: 760,
                margin: "0 auto",
                textAlign: "center",
                position: "relative",
                zIndex: 3,
              }
            : {
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
              }
        }
      >
        {showDecorations && (
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
        )}

        <h1
          className="hero-headline lingo-display"
          style={{
            fontWeight: underNav ? 800 : 700,
            fontSize: underNav ? "clamp(36px, 6vw, 64px)" : "clamp(36px, 5vw, 56px)",
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
            fontSize: underNav ? 18 : 17.5,
            fontWeight: underNav ? 500 : undefined,
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
          <PrimaryButton href={ctaHref} journeyTransition={journeyTransition}>
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
          height: fadeTo ? 72 : 140,
          marginTop: fadeTo ? -72 : -80,
          background: fadeTo
            ? `linear-gradient(to bottom, transparent 0%, ${fadeTo} 100%)`
            : "linear-gradient(to bottom, rgba(239,249,252,0) 0%, rgba(248,252,253,0.86) 60%, #ffffff 100%)",
        }}
      />
    </section>
  );
}
