"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  MdFormatQuote,
  MdTune,
  MdMenuBook,
  MdPsychology,
  MdLibraryBooks,
  MdCalendarToday,
} from "react-icons/md";
import type { IconType } from "react-icons";

const FEATURE_ICONS: Record<string, IconType> = {
  "Authentic sentences": MdFormatQuote,
  "Level tuning": MdTune,
  "Story reinforcement": MdMenuBook,
  "Quizzing + SRS": MdPsychology,
  "Flashcard decks": MdLibraryBooks,
  "Streak + activity": MdCalendarToday,
};

type FeatureCardProps = {
  title: string;
  description: string;
};

export default function FeatureCard({ title, description }: FeatureCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const Icon = FEATURE_ICONS[title];

  return (
    <motion.div
      whileHover={prefersReducedMotion ? undefined : { y: -4 }}
      style={{
        background: "#F4F8FB",
        borderRadius: 14,
        border: "1px solid rgba(0,0,0,0.05)",
        padding: 24,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "transform 0.2s",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          background: "#D6EEF8",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
          flexShrink: 0,
          color: "#2176AE",
        }}
      >
        {Icon && <Icon style={{ width: 18, height: 18 }} />}
      </div>
      <h3
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "#071E2E",
          marginBottom: 6,
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 13,
          color: "#5a7a88",
          lineHeight: 1.6,
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        {description}
      </p>
    </motion.div>
  );
}
