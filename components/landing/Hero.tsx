"use client";

import { motion, useReducedMotion } from "framer-motion";
import CTAButtonCard from "./CTAButtonCard";

export default function Hero() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="bg-gradient-to-b from-white to-gray-50 px-6 py-20 md:px-12 md:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left: Headline */}
          <motion.div
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex max-w-xl flex-col justify-center"
          >
            <h1 className="mb-8 text-5xl leading-tight tracking-tight md:text-6xl lg:text-7xl">
              <span className="font-serif italic text-gray-500">Learn</span>{" "}
              <span className="font-sans font-bold text-gray-900">
                Mandarin That Sticks
              </span>
            </h1>
            <p className="mb-6 text-xl leading-relaxed text-gray-700 md:text-2xl">
              Overcome the intermediate plateau with personalized stories and
              vocabulary about topics you care about.
            </p>
            <p className="text-lg leading-relaxed text-gray-600 md:text-xl">
              Relavance + Reinforcement = Retention
            </p>
          </motion.div>

          {/* Right: CTAs + Visual */}
          <div className="flex flex-col gap-4 lg:justify-center">
            <CTAButtonCard
              href="/onboarding/topic-island"
              title="Create a Topic Island"
              microcopy={[
                "Build vocabulary around topics that interest you. 10-20 words with pinyin, conventional examples, and translations.",
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
                "Turn your vocab into a short story for easy comprehensible input. Practice reading in context, for added reinforcement.",
              ]}
              variant="secondary"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
