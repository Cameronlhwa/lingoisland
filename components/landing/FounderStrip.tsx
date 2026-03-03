"use client";

import Link from "next/link";
import Image from "next/image";
import { FOUNDER_STRIP } from "@/lib/landing-content";
import { motion, useReducedMotion } from "framer-motion";

const FOUNDER_IMAGE = "/Cameron Lim Profile Photo.jpg";

export default function FounderStrip() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="founder-strip" className="border-y border-gray-100 bg-white px-6 py-16 md:px-12">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col items-start gap-6 rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50/80 to-white p-6 shadow-sm transition-shadow hover:shadow-md md:flex-row md:items-center md:gap-8 md:p-8"
        >
          <div className="relative size-20 shrink-0 overflow-hidden rounded-full md:size-24">
            <Image
              src={FOUNDER_IMAGE}
              alt="Cameron Lim, founder of LingoIsland"
              width={96}
              height={96}
              className="object-cover"
              sizes="(max-width: 768px) 80px, 96px"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-gray-900 md:text-2xl">
              {FOUNDER_STRIP.headline}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 md:text-base">
              {FOUNDER_STRIP.blurb}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {FOUNDER_STRIP.metrics.map((m) => (
                <span
                  key={m.value}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700"
                >
                  {m.value}
                </span>
              ))}
              <Link
                href={FOUNDER_STRIP.ctaHref}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-800 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
              >
                {FOUNDER_STRIP.ctaLabel}
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
