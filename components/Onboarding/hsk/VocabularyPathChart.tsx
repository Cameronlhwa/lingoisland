"use client";

import { motion, useReducedMotion } from "framer-motion";
import { formatHskLevel } from "@/lib/utils/hsk";

/**
 * Illustrative personalized vs generic path — not empirical data.
 * Designed as the dominant visual in the plan-reveal right column.
 */
export default function VocabularyPathChart({
  knownWords,
  goalWords,
  goalLevel,
}: {
  /** @deprecated Kept for call-site compatibility. */
  milestones?: { label: string; cumulativeWords: number }[];
  total?: number;
  knownWords?: number | null;
  goalWords?: number;
  goalLevel?: number;
  compact?: boolean;
  hideEndLabel?: boolean;
  personalizationSignals?: string[];
}) {
  const prefersReducedMotion = useReducedMotion();
  const hasKnown = typeof knownWords === "number" && knownWords >= 0;
  const hasGoal =
    hasKnown && typeof goalWords === "number" && (goalWords as number) > (knownWords as number);

  if (!hasKnown || !hasGoal) {
    return (
      <div
        className="flex flex-1 items-center justify-center text-center text-xs"
        style={{ color: "var(--lingo-text-muted)", minHeight: 140 }}
      >
        <span>
          <span className="font-semibold" style={{ color: "var(--lingo-navy)" }}>
            A path built for you
          </span>
          {" — "}
          focus on the words you need
        </span>
      </div>
    );
  }

  const known = knownWords as number;
  const goal = goalWords as number;
  const levelLabel = goalLevel ? formatHskLevel(goalLevel) : "Goal";

  // Tall viewBox so the plotted curves dominate the card
  const W = 360;
  const H = 150;
  const padL = 44;
  const padR = 52;
  const padT = 18;
  const padB = 22;
  const x0 = padL;
  const xEnd = W - padR;
  const yKnown = H - padB;
  const yGoal = padT;

  const xPersGoal = x0 + (xEnd - x0) * 0.72;
  const xGenEnd = xEnd;
  const yGenEnd = yKnown - (yKnown - yGoal) * 0.38;

  const persPath = `M ${x0} ${yKnown} C ${x0 + 42} ${yKnown - 6}, ${xPersGoal - 58} ${yGoal + 36}, ${xPersGoal} ${yGoal}`;
  const persArea = `${persPath} L ${xPersGoal} ${yKnown} L ${x0} ${yKnown} Z`;
  const genPath = `M ${x0} ${yKnown} C ${x0 + 62} ${yKnown - 2}, ${xGenEnd - 78} ${yGenEnd + 22}, ${xGenEnd} ${yGenEnd}`;

  const persLabelX = x0 + (xPersGoal - x0) * 0.48;
  const persLabelY = yKnown - (yKnown - yGoal) * 0.58 - 8;
  const genLabelX = x0 + (xGenEnd - x0) * 0.7;
  const genLabelY = yGenEnd + 14;

  return (
    <div
      className="flex h-full min-h-0 flex-col"
      style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}
    >
      {/* Word anchors integrated with the visual */}
      <div className="flex shrink-0 items-end justify-between gap-3 px-0.5">
        <div>
          <p className="lingo-display" style={{ fontSize: 22, lineHeight: 1, color: "var(--lingo-navy)" }}>
            ~{known.toLocaleString()}
          </p>
          <p
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--lingo-text-muted)",
              marginTop: 3,
            }}
          >
            Words now
          </p>
        </div>
        <div className="text-right">
          <p className="lingo-display" style={{ fontSize: 22, lineHeight: 1, color: "#168E9E" }}>
            {goal.toLocaleString()}
          </p>
          <p
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#168E9E",
              marginTop: 3,
              opacity: 0.9,
            }}
          >
            {levelLabel} goal
          </p>
        </div>
      </div>

      <div className="relative mt-1 min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
          className="overflow-visible"
        >
          <defs>
            <linearGradient id="persStroke" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#2176AE" />
              <stop offset="100%" stopColor="#2BBBAD" />
            </linearGradient>
            <linearGradient id="persFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2BBBAD" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#2176AE" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          <line
            x1={x0}
            y1={yKnown}
            x2={xEnd}
            y2={yKnown}
            stroke="rgba(33,118,174,0.1)"
            strokeWidth={1}
          />

          {/* Soft fill under personalized path */}
          <motion.path
            d={persArea}
            fill="url(#persFill)"
            stroke="none"
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: prefersReducedMotion ? 0 : 0.2 }}
          />

          {/* Generic study */}
          <path
            d={genPath}
            fill="none"
            stroke="#9aabb8"
            strokeWidth={1.75}
            strokeDasharray="5 4"
            strokeLinecap="round"
            opacity={0.85}
          />
          <text
            x={genLabelX}
            y={genLabelY}
            textAnchor="middle"
            fill="#8a9aab"
            fontSize={10}
            fontWeight={600}
            fontFamily="DM Sans, system-ui, sans-serif"
          >
            Generic study
          </text>

          {/* Personalized path */}
          <motion.path
            d={persPath}
            fill="none"
            stroke="url(#persStroke)"
            strokeWidth={3.25}
            strokeLinecap="round"
            initial={prefersReducedMotion ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
          <text
            x={persLabelX}
            y={persLabelY}
            textAnchor="middle"
            fill="#12314a"
            fontSize={10.5}
            fontWeight={700}
            fontFamily="DM Sans, system-ui, sans-serif"
          >
            Your personalized path
          </text>

          <circle cx={x0} cy={yKnown} r={4.5} fill="#fff" stroke="#2176AE" strokeWidth={2.25} />

          <motion.circle
            cx={xPersGoal}
            cy={yGoal}
            r={5.5}
            fill="#168E9E"
            style={{ filter: "drop-shadow(0 0 4px rgba(22,142,158,0.4))" }}
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.55, duration: 0.25 }}
          />
        </svg>
      </div>

      <p
        className="shrink-0 text-center leading-snug"
        style={{ fontSize: 10.5, color: "var(--lingo-text-muted)", paddingTop: 2 }}
      >
        Focus on the right words, in the right order, through topics you care about.
      </p>
    </div>
  );
}

export type ChartMilestone = {
  label: string;
  cumulativeWords: number;
};
