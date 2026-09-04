"use client";

import Link from "next/link";
import Image from "next/image";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import FadeSectionObserver from "@/components/landing/FadeSectionObserver";
import SectionHeader from "@/components/landing/SectionHeader";
import PrimaryButton from "@/components/landing/PrimaryButton";
import IconBadge from "@/components/landing/IconBadge";
import HSKNightCTA from "@/components/hskprep/HSKNightCTA";
import { Sparkle, FloatingCloud } from "@/components/landing/Decorations";
import { FOUNDER_PAGE } from "@/lib/landing-content";
import { motion, useReducedMotion } from "framer-motion";
import { Users, Play } from "lucide-react";

const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@cameronlim";
const YOUTUBE_VIDEO_URL = "https://www.youtube.com/watch?v=Iwvsh9bs_Nc";
const FOUNDER_IMAGE = "/Cameron Lim Profile Photo.jpg";
const YOUTUBE_THUMBNAIL = "/Youtube Thumbnail.png";

const CARD_SHADOW = "0 14px 40px rgba(44,105,128,0.08), 0 2px 8px rgba(44,105,128,0.05)";
const SECTION_BG =
  "radial-gradient(circle at 15% 20%, rgba(160,224,239,0.16), transparent 28%), radial-gradient(circle at 85% 60%, var(--lingo-accent-tint), transparent 30%), #FCFEFF";

export default function FounderPage() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <main style={{ background: "#fff" }}>
      <FadeSectionObserver />
      <Nav />

      {/* Hero — same fantasy artwork as /hskprep */}
      <section className="hero-scene" style={{ position: "relative", overflow: "hidden" }}>
        <div
          aria-hidden
          className="hero-scene-bg"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "url(/hskprep/hero-capybara-fantasy.png)",
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
            maxWidth: 1100,
            margin: "0 auto",
            padding: "48px 24px 24px",
            position: "relative",
            zIndex: 3,
            minHeight: "clamp(520px, 72vh, 720px)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: "-20px -4% 0",
              zIndex: -1,
              background:
                "radial-gradient(ellipse at center, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.22) 45%, transparent 75%)",
              pointerEvents: "none",
            }}
          />

          <Link
            href="/"
            className="mb-5 inline-flex w-fit items-center gap-2 text-sm font-semibold no-underline transition-colors hover:opacity-80"
            style={{ color: "var(--lingo-text-muted)", fontFamily: "'DM Sans', system-ui, sans-serif" }}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to home
          </Link>

          <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
            <motion.div
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1
                className="lingo-display"
                style={{
                  fontWeight: 700,
                  fontSize: "clamp(32px, 4.5vw, 48px)",
                  lineHeight: 1.08,
                  letterSpacing: "-0.03em",
                  color: "var(--lingo-navy)",
                  marginBottom: 16,
                }}
              >
                {FOUNDER_PAGE.hero.title}
              </h1>
              <p
                style={{
                  fontSize: 17.5,
                  color: "var(--lingo-text-muted)",
                  lineHeight: 1.65,
                  maxWidth: 520,
                  marginBottom: 28,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                {FOUNDER_PAGE.hero.intro}
              </p>
              <div className="flex flex-wrap gap-3">
                <PrimaryButton href={FOUNDER_PAGE.hero.ctaPrimary.href}>
                  {FOUNDER_PAGE.hero.ctaPrimary.label}
                  <span className="inline-block transition-transform duration-200 group-hover:translate-x-[3px]">
                    →
                  </span>
                </PrimaryButton>
                <a
                  href={YOUTUBE_CHANNEL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 no-underline transition-all duration-200 hover:-translate-y-0.5"
                  style={{
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    fontWeight: 700,
                    fontSize: 15,
                    color: "var(--lingo-navy)",
                    borderRadius: 18,
                    padding: "15px 27px",
                    background: "rgba(255,255,255,0.75)",
                    border: "1px solid rgba(67,146,172,0.18)",
                    boxShadow:
                      "0 5px 16px rgba(75,140,164,0.08), inset 0 1px 0 rgba(255,255,255,0.9)",
                  }}
                >
                  {FOUNDER_PAGE.hero.ctaSecondary.label}
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative mx-auto lg:mx-0"
            >
              <div
                className="relative aspect-square w-48 overflow-hidden lg:w-64"
                style={{
                  borderRadius: 24,
                  boxShadow: "0 20px 48px rgba(44,105,128,0.22)",
                  border: "3px solid rgba(255,255,255,0.9)",
                }}
              >
                <Image
                  src={FOUNDER_IMAGE}
                  alt="Cameron Lim, founder of LingoIsland"
                  width={256}
                  height={256}
                  className="object-cover"
                  sizes="(max-width: 1024px) 192px, 256px"
                />
              </div>
            </motion.div>
          </div>
        </div>

        <div
          aria-hidden
          style={{
            position: "relative",
            zIndex: 2,
            height: 120,
            marginTop: -60,
            background:
              "linear-gradient(to bottom, rgba(239,249,252,0) 0%, rgba(248,252,253,0.86) 60%, #ffffff 100%)",
          }}
        />
      </section>

      {/* My story */}
      <section className="fade-section" style={{ background: SECTION_BG, padding: "100px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <SectionHeader eyebrow="Origin" title={FOUNDER_PAGE.story.title} />
          <div className="mt-2 grid gap-6 md:grid-cols-3">
            {FOUNDER_PAGE.story.steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.4, delay: index * 0.06 }}
                whileHover={prefersReducedMotion ? undefined : { y: -4 }}
                style={{
                  background: "rgba(255,255,255,0.92)",
                  border: "1px solid rgba(72,150,175,0.12)",
                  borderRadius: 24,
                  padding: "28px 24px",
                  boxShadow: CARD_SHADOW,
                }}
              >
                <div
                  className="lingo-display mb-4 flex h-9 w-9 items-center justify-center text-sm font-bold"
                  style={{
                    borderRadius: 12,
                    background: "var(--lingo-accent-gradient)",
                    color: "#fff",
                    boxShadow: "var(--lingo-accent-shadow)",
                  }}
                >
                  {index + 1}
                </div>
                <h3
                  className="lingo-display mb-2 text-base font-semibold"
                  style={{ color: "var(--lingo-navy)" }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.65,
                    color: "var(--lingo-text-muted)",
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                  }}
                >
                  {step.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* YouTube proof */}
      <section
        className="fade-section"
        style={{
          background:
            "radial-gradient(circle at 90% 10%, rgba(160,224,239,0.14), transparent 30%), #fff",
          padding: "100px 24px",
        }}
      >
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <SectionHeader eyebrow="On YouTube" title={FOUNDER_PAGE.proof.title} />
          <div className="grid gap-10 lg:grid-cols-[1fr_minmax(280px,380px)] lg:items-start">
            <motion.div
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.45 }}
            >
              <p
                style={{
                  fontSize: 17,
                  lineHeight: 1.65,
                  color: "var(--lingo-text-muted)",
                  maxWidth: 520,
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                {FOUNDER_PAGE.proof.body}
              </p>
              {FOUNDER_PAGE.proof.chips?.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {FOUNDER_PAGE.proof.chips.map((chip) => (
                    <span
                      key={chip}
                      style={{
                        background: "linear-gradient(160deg, #EAF4FB 0%, #DCEEF6 100%)",
                        boxShadow:
                          "0 1px 0 rgba(255,255,255,0.8) inset, 0 4px 10px -4px rgba(33,118,174,0.3)",
                        borderRadius: 999,
                        padding: "7px 14px",
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: "var(--lingo-navy)",
                        fontFamily: "'DM Sans', system-ui, sans-serif",
                      }}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.a
              href={YOUTUBE_VIDEO_URL}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="order-first block overflow-hidden no-underline lg:order-none"
              style={{
                borderRadius: 24,
                border: "1px solid rgba(72,150,175,0.12)",
                background: "#fff",
                boxShadow: CARD_SHADOW,
              }}
              aria-label="Watch Cameron Lim on YouTube"
            >
              <div className="relative aspect-video bg-[var(--lingo-sky-soft)]">
                <Image
                  src={YOUTUBE_THUMBNAIL}
                  alt="Cameron Lim YouTube channel"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 380px"
                />
              </div>
              <div className="border-t border-[rgba(72,150,175,0.1)] px-4 py-3">
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--lingo-navy)", fontFamily: "'DM Sans', system-ui, sans-serif" }}
                >
                  @cameronlim
                </p>
                <p className="text-xs" style={{ color: "var(--lingo-text-muted)" }}>
                  Study vlogs · Practical learning
                </p>
              </div>
            </motion.a>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {FOUNDER_PAGE.proof.metrics.map((metric) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                whileHover={prefersReducedMotion ? undefined : { y: -3 }}
                className="flex items-start gap-4"
                style={{
                  background: "rgba(255,255,255,0.92)",
                  border: "1px solid rgba(72,150,175,0.12)",
                  borderRadius: 24,
                  padding: 24,
                  boxShadow: CARD_SHADOW,
                }}
              >
                <IconBadge size={44}>
                  {metric.icon === "subscribers" ? (
                    <Users className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" fill="currentColor" />
                  )}
                </IconBadge>
                <div>
                  <div
                    className="lingo-display text-2xl font-bold md:text-3xl"
                    style={{ color: "var(--lingo-navy)", letterSpacing: "-0.03em" }}
                  >
                    {metric.value}
                  </div>
                  <div
                    className="mt-0.5 text-sm font-medium"
                    style={{
                      color: "var(--lingo-text-muted)",
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                    }}
                  >
                    {metric.label}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {FOUNDER_PAGE.proof.ctaLabel && FOUNDER_PAGE.proof.ctaHref && (
            <p className="mt-6 text-center">
              <a
                href={FOUNDER_PAGE.proof.ctaHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold no-underline underline-offset-2 hover:underline"
                style={{ color: "var(--lingo-teal)", fontFamily: "'DM Sans', system-ui, sans-serif" }}
              >
                {FOUNDER_PAGE.proof.ctaLabel}
                <span aria-hidden>→</span>
              </a>
            </p>
          )}
        </div>
      </section>

      {/* How I build */}
      <section className="fade-section" style={{ background: SECTION_BG, padding: "100px 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <SectionHeader eyebrow="Principles" title={FOUNDER_PAGE.principles.title} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FOUNDER_PAGE.principles.items.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: index * 0.04 }}
                whileHover={prefersReducedMotion ? undefined : { y: -3 }}
                style={{
                  background: "rgba(255,255,255,0.92)",
                  border: "1px solid rgba(72,150,175,0.12)",
                  borderRadius: 20,
                  padding: 22,
                  boxShadow: CARD_SHADOW,
                }}
              >
                <h3
                  className="lingo-display text-base font-semibold"
                  style={{ color: "var(--lingo-navy)" }}
                >
                  {item.title}
                </h3>
                <p
                  className="mt-1.5 text-sm leading-relaxed"
                  style={{
                    color: "var(--lingo-text-muted)",
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                  }}
                >
                  {item.line}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* What's next */}
      <section
        className="fade-section"
        style={{
          background: "#fff",
          padding: "100px 24px",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <SectionHeader eyebrow="Roadmap" title={FOUNDER_PAGE.roadmap.title} align="left" />
          <ul className="mt-2 space-y-3">
            {FOUNDER_PAGE.roadmap.bullets.map((bullet) => (
              <li
                key={bullet}
                className="flex items-start gap-3"
                style={{
                  borderRadius: 16,
                  border: "1px solid rgba(72,150,175,0.12)",
                  background: "var(--lingo-sky-pale)",
                  padding: "14px 18px",
                  color: "var(--lingo-text)",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontSize: 15,
                  lineHeight: 1.55,
                }}
              >
                <span
                  className="mt-1.5 size-2 shrink-0 rounded-full"
                  style={{ background: "var(--lingo-accent-end)" }}
                  aria-hidden
                />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <HSKNightCTA
        title={FOUNDER_PAGE.finalCta.title}
        subtitle={FOUNDER_PAGE.finalCta.subline}
        primary={{
          href: FOUNDER_PAGE.finalCta.ctaPrimary.href,
          label: FOUNDER_PAGE.finalCta.ctaPrimary.label,
        }}
        secondary={{ href: YOUTUBE_CHANNEL_URL, label: "Watch on YouTube" }}
      />

      <Footer />
    </main>
  );
}
