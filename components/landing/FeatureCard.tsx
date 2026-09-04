"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  MdFormatQuote,
  MdTune,
  MdMenuBook,
  MdPsychology,
  MdLibraryBooks,
  MdCalendarToday,
  MdExplore,
  MdSchedule,
  MdQuiz,
  MdTrackChanges,
  MdVolumeUp,
} from "react-icons/md";
import type { IconType } from "react-icons";
import IconBadge from "./IconBadge";

const FEATURE_ICONS: Record<string, IconType> = {
  "Authentic sentences": MdFormatQuote,
  "Level tuning": MdTune,
  "Story reinforcement": MdMenuBook,
  "Quizzing + SRS": MdPsychology,
  "Flashcard decks": MdLibraryBooks,
  "Streak + activity": MdCalendarToday,
  "Official HSK Vocabulary": MdMenuBook,
  "Personalized Topics": MdExplore,
  "Self-Paced Review": MdSchedule,
  "150+ Practice Tests": MdQuiz,
  "Targeted Weak-Spot Practice": MdTrackChanges,
  "Audio On Every Word": MdVolumeUp,
};

const SHADOW = "0 14px 40px rgba(44,105,128,0.08), 0 2px 8px rgba(44,105,128,0.05)";
const SHADOW_HOVER = "0 20px 48px rgba(44,105,128,0.12), 0 5px 12px rgba(44,105,128,0.06)";

type FeatureCardProps = {
  title: string;
  description: string;
};

export default function FeatureCard({ title, description }: FeatureCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const Icon = FEATURE_ICONS[title];
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      whileHover={prefersReducedMotion ? undefined : { y: -5 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        borderRadius: 24,
        background: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(72,150,175,0.12)",
        padding: 26,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        boxShadow: hovered ? SHADOW_HOVER : SHADOW,
        transition: "box-shadow 0.25s ease",
      }}
    >
      <div
        style={{
          marginBottom: 16,
          transform:
            !prefersReducedMotion && hovered
              ? "translateY(-2px) rotate(-2deg) scale(1.03)"
              : "none",
          transition: "transform 0.25s ease",
        }}
      >
        <IconBadge>{Icon && <Icon style={{ width: 22, height: 22 }} />}</IconBadge>
      </div>
      <h3
        className="lingo-display"
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: "var(--lingo-navy)",
          marginBottom: 7,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 13.5,
          color: "var(--lingo-text-muted)",
          lineHeight: 1.65,
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        {description}
      </p>
    </motion.div>
  );
}
