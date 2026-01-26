"use client";

import { motion, useReducedMotion } from "framer-motion";
import CTAButtonCard from "./CTAButtonCard";

export default function FinalCTA() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="bg-white px-6 py-20 md:px-12">
      <motion.div
        initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.4 }}
        className="mx-auto max-w-6xl rounded-3xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-10 shadow-sm md:p-12"
      >
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">
              Ready to build vocabulary you can actually use?
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Create a Topic Island or spin your words into a story. Both paths
              get you to real-life Mandarin faster.
            </p>
          </div>
          <div className="space-y-4">
            <CTAButtonCard
              href="/onboarding/topic-island"
              title="Create Topic Island"
              microcopy={[
                "Pick a topic → get 10–20 useful words",
                "with real-life sentences at your level",
              ]}
              tooltip={{
                label: "What’s a Topic Island?",
                content:
                  "A focused set of 10–20 related words with authentic sentences tuned to your level.",
              }}
            />
            <CTAButtonCard
              href="/onboarding/story"
              title="Create a Story"
              microcopy={[
                "Turn your vocab into a short story",
                "for easy comprehensible input",
              ]}
              variant="secondary"
            />
          </div>
        </div>
      </motion.div>
    </section>
  );
}

