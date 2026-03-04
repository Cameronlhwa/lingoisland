"use client";

import { motion, useReducedMotion } from "framer-motion";
import CTAButtonCard from "./CTAButtonCard";

export default function Hero() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="px-6 py-12 md:px-12 md:py-16">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Left: Headline — solid panel for clear readability */}
          <motion.div
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex max-w-xl flex-col justify-center rounded-2xl bg-white px-6 py-6 shadow-md md:px-8 md:py-8"
          >
            <h1 className="mb-5 text-4xl leading-tight tracking-tight md:text-5xl lg:text-6xl">
              <span className="font-serif italic text-gray-500">Learn</span>{" "}
              <span className="font-sans font-bold text-gray-900">
                Mandarin That Sticks
              </span>
            </h1>
            <p className="mb-4 text-lg leading-relaxed text-gray-700 md:text-xl">
              Overcome the intermediate plateau with personalized stories and
              vocabulary about topics you care about.
            </p>
            <p className="text-sm leading-relaxed text-gray-600 md:text-base">
              Relevance + Reinforcement = Retention
            </p>
          </motion.div>

          {/* Right: CTAs + Visual */}
          <div className="flex flex-col gap-4 lg:justify-center">
            <CTAButtonCard
              href="/onboarding/topic-island"
              title="Create a Topic Island"
              microcopy={[
                "Build vocabulary around topics that interest you. 10-20 words and conversational examples, each with Hanzi, Pinyin, audio, and translations.",
              ]}
              tooltip={{
                label: "What's a Topic Island?",
                content:
                  "A focused set of 10–20 related words with authentic sentences tuned to your level.",
              }}
            />
            <CTAButtonCard
              href="/onboarding/story"
              title="Create a Story"
              microcopy={[
                "Turn your vocab into a short story for easy comprehensible input. Practice reading in context for added reinforcement.",
              ]}
              variant="secondary"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
