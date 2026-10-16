"use client";

import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import Card from "@/components/ui/Card";
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

type FeatureCardProps = {
  title: string;
  description: string;
};

export default function FeatureCard({ title, description }: FeatureCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const Icon = FEATURE_ICONS[title];
  const [hovered, setHovered] = useState(false);

  return (
    <Card
      className="flex h-full flex-col"
      style={{ height: "100%" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
    </Card>
  );
}
