"use client";

import { TOPIC_TILES } from "@/lib/landing-content";
import TopicTile from "./TopicTile";
import { motion, useReducedMotion } from "framer-motion";

export default function TopicsGrid() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section id="topics" className="bg-gray-50 px-6 py-24 md:px-12">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4 }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">
            Browse topics
          </h2>
          <p className="mt-3 text-lg text-gray-600">
            Pick a topic and jump straight into practical, real-world vocabulary.
          </p>
        </motion.div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {TOPIC_TILES.map((topic) => (
            <TopicTile key={topic.slug} topic={topic} />
          ))}
        </div>
      </div>
    </section>
  );
}

