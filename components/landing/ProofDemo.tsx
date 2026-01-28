"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function ProofDemo() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="demo" className="bg-gray-50 px-6 py-16 md:px-12 md:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">
              See a Topic Island in action
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Watch how we generate authentic, level-tuned sentences for topics
              you care about.
            </p>
            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700">
              <p className="font-semibold text-gray-900">
                Authentic sentences + Level tuning
              </p>
              <p className="mt-2 text-gray-600">
                This is the core differentiator: vocabulary you can actually use
                in real life.
              </p>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl border border-gray-900 bg-gray-900 p-2 shadow-lg"
          >
            <div className="overflow-hidden rounded-xl">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full"
                aria-label="Demo video showing topic island creation"
              >
                <source src="/Recording of Lingoisland2.mov" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
