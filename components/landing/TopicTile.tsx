"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { TopicTile as TopicTileType } from "@/lib/landing-content";

type TopicTileProps = {
  topic: TopicTileType;
};

export default function TopicTile({ topic }: TopicTileProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      whileHover={prefersReducedMotion ? undefined : { y: -4 }}
      style={{
        background: "#fff",
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.07)",
        padding: "22px 24px",
        height: "100%",
        transition: "transform 0.2s",
      }}
    >
      <Link
        href={`/onboarding/journey?topic=${encodeURIComponent(topic.title)}`}
        style={{ display: "block", textDecoration: "none" }}
      >
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: "#071E2E",
            marginBottom: 6,
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          {topic.title}
        </h3>
        <p
          style={{
            fontSize: 12,
            color: "#7a9aaa",
            marginBottom: 16,
            lineHeight: 1.5,
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          {topic.description}
        </p>

        {/* Vocab rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {topic.sampleWords.map((word) => (
            <div
              key={word.hanzi}
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#071E2E",
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                {word.hanzi}
              </span>
              <span style={{ fontSize: 11, color: "#7aA0b4" }}>{word.pinyin}</span>
              <span style={{ fontSize: 11, color: "#7aA0b4" }}>• {word.meaning}</span>
            </div>
          ))}
        </div>

        {/* Sample sentence */}
        <p
          style={{
            background: "#F4F8FB",
            borderRadius: 8,
            padding: "8px 12px",
            fontSize: 12,
            color: "#3a6e88",
            lineHeight: 1.6,
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}
        >
          {topic.sampleSentence}
        </p>
      </Link>
    </motion.div>
  );
}
