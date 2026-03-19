"use client";

import Link from "next/link";
import { TOPIC_TILES } from "@/lib/landing-content";
import TopicTile from "./TopicTile";
import { motion, useReducedMotion } from "framer-motion";

export default function TopicsGrid() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id="topics"
      className="fade-section"
      style={{ background: "#F4F8FB", padding: "80px 24px" }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4 }}
          style={{ textAlign: "center", marginBottom: 48 }}
        >
          <h2
            style={{
              fontFamily: "'Lora', Georgia, serif",
              fontWeight: 600,
              fontSize: 36,
              lineHeight: 1.15,
              color: "#071E2E",
              marginBottom: 12,
            }}
          >
            Browse topics
          </h2>
          <p
            style={{
              fontSize: 16,
              color: "#3a6e88",
              lineHeight: 1.65,
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}
          >
            Pick a topic and jump straight into practical, real-world vocabulary.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOPIC_TILES.map((topic) => (
            <TopicTile key={topic.slug} topic={topic} />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4 }}
          style={{ textAlign: "center", marginTop: 40 }}
        >
          <Link
            href="/topics"
            style={{
              display: "inline-flex",
              borderRadius: 8,
              border: "1.5px solid #071E2E",
              background: "#fff",
              padding: "10px 24px",
              fontWeight: 600,
              fontSize: 14,
              color: "#071E2E",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              textDecoration: "none",
              transition: "background 0.15s",
            }}
            className="hover:bg-[#F4F8FB]"
          >
            View more topics
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
