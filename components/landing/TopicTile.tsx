"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { TopicTile as TopicTileType } from "@/lib/landing-content";

type TopicTileProps = {
  topic: TopicTileType;
  index?: number;
};

export default function TopicTile({ topic, index = 0 }: TopicTileProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.4,
        delay: prefersReducedMotion ? 0 : Math.min(index * 0.05, 0.3),
      }}
      whileHover={prefersReducedMotion ? undefined : { y: -4 }}
      style={{
        background: "#fff",
        borderRadius: "var(--lingo-radius-card)",
        border: "1px solid var(--lingo-border)",
        boxShadow: "var(--lingo-shadow-card)",
        padding: "22px 24px",
        height: "100%",
        transition: "box-shadow 200ms ease, border-color 200ms ease",
      }}
      className="group"
    >
      <Link
        href={`/onboarding/journey?topic=${encodeURIComponent(topic.title)}`}
        style={{ display: "block", textDecoration: "none", height: "100%" }}
      >
        <h3
          className="lingo-display"
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: "var(--lingo-navy)",
            marginBottom: 6,
          }}
        >
          {topic.title}
        </h3>
        <p
          style={{
            fontSize: 13,
            color: "var(--lingo-text-muted)",
            marginBottom: 16,
            lineHeight: 1.55,
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          {topic.description}
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {topic.sampleWords.map((word) => (
            <div
              key={word.hanzi}
              style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--lingo-navy)",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                {word.hanzi}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: "var(--lingo-navy)",
                  background: "var(--lingo-accent-tint)",
                  border: "1px solid var(--lingo-accent-border)",
                  borderRadius: 999,
                  padding: "2px 8px",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                {word.pinyin}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  color: "var(--lingo-text-muted)",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                {word.meaning}
              </span>
            </div>
          ))}
        </div>

        <p
          style={{
            background: "var(--lingo-sky-pale)",
            borderRadius: 12,
            border: "1px solid var(--lingo-border)",
            padding: "10px 12px",
            fontSize: 13,
            color: "var(--lingo-navy)",
            lineHeight: 1.6,
            fontFamily: "'DM Sans', system-ui, sans-serif",
            margin: 0,
          }}
        >
          {topic.sampleSentence}
        </p>

        <span
          style={{
            display: "inline-block",
            marginTop: 14,
            fontSize: 13,
            fontWeight: 700,
            color: "var(--lingo-teal)",
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          Start this island →
        </span>
      </Link>
    </motion.div>
  );
}
