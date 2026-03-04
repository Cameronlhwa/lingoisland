"use client";

import Link from "next/link";
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
        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4 }}
          className="mt-10 text-center"
        >
          <Link
            href="/topics"
            className="inline-flex rounded-lg border-2 border-gray-900 bg-white px-6 py-3 font-semibold text-gray-900 transition-colors hover:bg-gray-50"
          >
            View more topics
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

