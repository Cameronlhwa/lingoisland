"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MdExplore, MdSchedule, MdQuiz, MdMenuBook, MdAutoStories } from "react-icons/md";
import type { IconType } from "react-icons";
import { HSK_PILLARS } from "@/lib/hskprep-content";
import SectionHeader from "@/components/landing/SectionHeader";
import IconBadge from "@/components/landing/IconBadge";
import { CapybaraPeek } from "@/components/landing/Decorations";

const PILLAR_ICONS: Record<string, IconType> = {
  explore: MdExplore,
  schedule: MdSchedule,
  quiz: MdQuiz,
  book: MdMenuBook,
  stories: MdAutoStories,
};

const SHADOW = "0 14px 40px rgba(44,105,128,0.08), 0 2px 8px rgba(44,105,128,0.05)";
const SHADOW_HOVER = "0 20px 48px rgba(44,105,128,0.12), 0 5px 12px rgba(44,105,128,0.06)";

type Pillar = { title: string; body: string; icon: string };

export default function HSKPillars({
  eyebrow = "Why it works",
  title = "Why LingoIsland works",
  pillars = HSK_PILLARS,
  capybaraOnTitle = "150+ Practice Tests",
}: {
  eyebrow?: string;
  title?: string;
  pillars?: Pillar[];
  /** Pillar title that gets the peeking capybara flourish. */
  capybaraOnTitle?: string | null;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id="why"
      className="fade-section"
      style={{
        position: "relative",
        background:
          "radial-gradient(circle at 15% 20%, rgba(160,224,239,0.16), transparent 28%), radial-gradient(circle at 85% 60%, var(--lingo-accent-tint), transparent 30%), #FCFEFF",
        padding: "120px 24px",
        overflow: "hidden",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto", position: "relative" }}>
        <SectionHeader eyebrow={eyebrow} title={title} />

        <div className="relative grid grid-cols-1 gap-6 pt-10 md:grid-cols-3">
          {pillars.map((pillar, index) => (
            <PillarCard
              key={pillar.title}
              pillar={pillar}
              index={index}
              prefersReducedMotion={!!prefersReducedMotion}
              showCapybara={capybaraOnTitle != null && pillar.title === capybaraOnTitle}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PillarCard({
  pillar,
  index,
  prefersReducedMotion,
  showCapybara = false,
}: {
  pillar: Pillar;
  index: number;
  prefersReducedMotion: boolean;
  showCapybara?: boolean;
}) {
  const Icon = PILLAR_ICONS[pillar.icon];
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.45, delay: index * 0.08 }}
      whileHover={prefersReducedMotion ? undefined : { y: -5 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        position: "relative",
        background: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(72,150,175,0.12)",
        borderRadius: 24,
        padding: "28px 24px",
        boxShadow: hovered ? SHADOW_HOVER : SHADOW,
        transition: "box-shadow 0.25s ease",
      }}
    >
      {showCapybara && (
        <CapybaraPeek
          width={105}
          className="hidden sm:block max-md:!w-[88px] max-md:!-top-[28px] max-md:!right-3"
          style={{ top: -34, right: 18 }}
        />
      )}
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
          marginBottom: 8,
        }}
      >
        {pillar.title}
      </h3>
      <p
        style={{
          fontSize: 13.5,
          color: "var(--lingo-text-muted)",
          lineHeight: 1.65,
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        {pillar.body}
      </p>
    </motion.div>
  );
}
