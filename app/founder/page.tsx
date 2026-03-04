"use client";

import Link from "next/link";
import Image from "next/image";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import { OceanBackground } from "@/components/OceanBackground";
import { FOUNDER_PAGE } from "@/lib/landing-content";
import { motion, useReducedMotion } from "framer-motion";

const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@cameronlim";
const YOUTUBE_VIDEO_URL = "https://www.youtube.com/watch?v=Iwvsh9bs_Nc";
const FOUNDER_IMAGE = "/Cameron Lim Profile Photo.jpg";
const YOUTUBE_THUMBNAIL = "/Youtube Thumbnail.png";

export default function FounderPage() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <main className="relative min-h-screen">
      <OceanBackground />
      <div className="relative z-10">
        <Nav />

        {/* Hero */}
        <section className="px-6 py-16 md:px-12 md:py-24">
          <div className="mx-auto max-w-6xl">
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0B1B3A] focus:ring-offset-2 rounded"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to home
            </Link>
            <div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-center">
              <motion.div
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="rounded-2xl bg-white/90 px-6 py-8 shadow-md backdrop-blur-sm md:bg-white/85 md:px-8 md:py-10"
              >
                <h1 className="text-3xl font-semibold tracking-tight text-gray-900 md:text-4xl lg:text-5xl">
                  {FOUNDER_PAGE.hero.title}
                </h1>
                <p className="mt-4 max-w-xl text-lg leading-relaxed text-gray-700">
                  {FOUNDER_PAGE.hero.intro}
                </p>
                <div className="mt-8 flex flex-wrap gap-4">
                  <Link
                    href={FOUNDER_PAGE.hero.ctaPrimary.href}
                    className="inline-flex items-center rounded-lg border border-[#0B1B3A] bg-[#0B1B3A] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-[#0f2744] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#0B1B3A] focus:ring-offset-2"
                  >
                    {FOUNDER_PAGE.hero.ctaPrimary.label}
                  </Link>
                  <a
                    href={YOUTUBE_CHANNEL_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-lg border-2 border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-[#0B1B3A]/30 hover:bg-gray-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
                    aria-label="Watch Cameron Lim on YouTube"
                  >
                    {FOUNDER_PAGE.hero.ctaSecondary.label}
                  </a>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="relative flex justify-center lg:block lg:justify-start"
              >
                <div className="relative aspect-square w-48 overflow-hidden rounded-2xl shadow-xl ring-4 ring-white/80 lg:w-64">
                  <div
                    className="absolute inset-0 rounded-2xl ring-2 ring-[#0B1B3A]/10"
                    aria-hidden
                  />
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
        </section>

        {/* My story */}
        <section className="border-t border-gray-200/80 bg-gradient-to-b from-gray-50 to-white px-6 py-20 md:px-12">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
              {FOUNDER_PAGE.story.title}
            </h2>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {FOUNDER_PAGE.story.steps.map((step, index) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                  className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-md transition-shadow hover:shadow-lg"
                >
                  <span className="mb-3 inline-flex size-8 items-center justify-center rounded-lg bg-[#0B1B3A]/10 text-sm font-semibold text-[#0B1B3A]">
                    {index + 1}
                  </span>
                  <h3 className="mb-2 text-base font-semibold text-gray-900">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-gray-600">
                    {step.body}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* YouTube credibility — premium founder proof */}
        <section
          className="relative border-t border-gray-200/80 px-6 py-20 md:px-12"
          style={{
            background:
              "linear-gradient(to bottom, #EAF6FF 0%, #EAF6FF 25%, rgba(255,255,255,0.97) 60%, #fff 100%)",
          }}
        >
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-12 lg:grid-cols-[1fr,minmax(280px,400px)] lg:items-start">
              {/* Left: headline + copy + chips */}
              <motion.div
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.45 }}
                className="min-w-0"
              >
                <h2 className="text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
                  {FOUNDER_PAGE.proof.title}
                </h2>
                <p className="mt-4 max-w-xl text-lg leading-relaxed text-gray-700">
                  {FOUNDER_PAGE.proof.body}
                </p>
                {FOUNDER_PAGE.proof.chips &&
                  FOUNDER_PAGE.proof.chips.length > 0 && (
                    <div className="mt-6 flex flex-wrap gap-2">
                      {FOUNDER_PAGE.proof.chips.map((chip) => (
                        <span
                          key={chip}
                          className="rounded-full border border-[#0B1B3A]/12 bg-white/90 px-3.5 py-1.5 text-sm font-medium text-gray-700 shadow-sm"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  )}
              </motion.div>

              {/* Right: creator card (thumbnail-style placeholder) */}
              <motion.div
                initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.45, delay: 0.08 }}
                className="order-first lg:order-none"
              >
                <a
                  href={YOUTUBE_VIDEO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-lg ring-1 ring-black/5 transition-shadow hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#0B1B3A]/20 focus:ring-offset-2"
                  aria-label="Watch Cameron Lim on YouTube"
                >
                  <div className="relative aspect-video bg-gray-100">
                    <Image
                      src={YOUTUBE_THUMBNAIL}
                      alt="Cameron Lim YouTube channel"
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 400px"
                    />
                  </div>
                  <div className="border-t border-gray-100 px-4 py-3">
                    <p className="text-sm font-medium text-gray-900">@cameronlim</p>
                    <p className="text-xs text-gray-500">Study vlogs · Practical learning</p>
                  </div>
                </a>
              </motion.div>
            </div>

            {/* Metrics row + micro-caption + CTA */}
            <motion.div
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="mt-10 lg:mt-12"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {FOUNDER_PAGE.proof.metrics.map((metric) => (
                  <motion.div
                    key={metric.label}
                    whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                    className="flex items-start gap-4 rounded-2xl border border-[#0B1B3A]/10 bg-white/90 p-6 shadow-md transition-shadow hover:shadow-lg"
                  >
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0B1B3A]/10 text-[#0B1B3A]"
                      aria-hidden
                    >
                      {metric.icon === "subscribers" ? (
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.8}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="h-5 w-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </span>
                    <div>
                      <div className="text-2xl font-bold tracking-tight text-[#0B1B3A] md:text-3xl">
                        {metric.value}
                      </div>
                      <div className="mt-0.5 text-sm font-medium text-gray-600">
                        {metric.label}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              {FOUNDER_PAGE.proof.ctaLabel && FOUNDER_PAGE.proof.ctaHref && (
                <p className="mt-4 text-center">
                  <a
                    href={FOUNDER_PAGE.proof.ctaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 underline-offset-2 hover:text-[#0B1B3A] hover:underline focus:outline-none focus:ring-2 focus:ring-[#0B1B3A]/20 focus:ring-offset-2 rounded"
                    aria-label="Watch Cameron Lim on YouTube"
                  >
                    {FOUNDER_PAGE.proof.ctaLabel}
                    <span aria-hidden>→</span>
                  </a>
                </p>
              )}
            </motion.div>
          </div>
        </section>

        {/* How I build */}
        <section className="border-t border-gray-200/80 bg-gradient-to-b from-gray-50 to-white px-6 py-20 md:px-12">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
              {FOUNDER_PAGE.principles.title}
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FOUNDER_PAGE.principles.items.map((item) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                  className="rounded-xl border border-gray-200 bg-white p-5 shadow-md transition-shadow hover:border-[#0B1B3A]/15 hover:shadow-lg"
                >
                  <h3 className="text-base font-semibold text-gray-900">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
                    {item.line}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* What's next */}
        <section className="border-t border-gray-200/80 bg-white px-6 py-20 md:px-12">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
              {FOUNDER_PAGE.roadmap.title}
            </h2>
            <ul className="mt-6 space-y-4">
              {FOUNDER_PAGE.roadmap.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/80 py-3 pl-4 pr-4 text-gray-700"
                >
                  <span
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-[#0B1B3A]/40"
                    aria-hidden
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-gray-200/80 bg-gradient-to-b from-gray-50 to-[#EAF6FF]/30 px-6 py-20 md:px-12">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.4 }}
              className="rounded-3xl border-2 border-[#0B1B3A]/15 bg-gradient-to-br from-white to-[#EAF6FF]/40 p-10 shadow-xl md:p-12"
            >
              <h2 className="text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">
                {FOUNDER_PAGE.finalCta.title}
              </h2>
              <p className="mt-3 text-lg text-gray-700">
                {FOUNDER_PAGE.finalCta.subline}
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href={FOUNDER_PAGE.finalCta.ctaPrimary.href}
                  className="inline-flex items-center rounded-lg border border-[#0B1B3A] bg-[#0B1B3A] px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#0f2744] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#0B1B3A] focus:ring-offset-2"
                >
                  {FOUNDER_PAGE.finalCta.ctaPrimary.label}
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}
