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
      className="h-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-gray-300"
    >
      <Link href={`/onboarding/topic-island?topic=${encodeURIComponent(topic.title)}`} className="block">
        <h3 className="text-lg font-semibold text-gray-900">{topic.title}</h3>
        <p className="mt-2 text-sm text-gray-600">{topic.description}</p>
        <div className="mt-4 space-y-2 text-sm text-gray-700">
          {topic.sampleWords.map((word) => (
            <div key={word.hanzi} className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{word.hanzi}</span>
              <span className="text-xs text-gray-500">{word.pinyin}</span>
              <span className="text-xs text-gray-500">• {word.meaning}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-700">
          {topic.sampleSentence}
        </p>
      </Link>
    </motion.div>
  );
}

