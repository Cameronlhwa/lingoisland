"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { Check, Flag, Headphones, Volume2, Waves, Wind } from "lucide-react";
import { COURSE_UNITS } from "@/lib/pronunciation/course/content";
import { unitMasteredCount, type CourseProgress } from "@/lib/pronunciation/course/progress";
import styles from "./ToneCoursePath.module.css";

const UNIT_ICONS = [Waves, Wind, Headphones, Volume2, Flag];
// Positions are shared by the SVG and the nodes, so connectors stay attached at every width.
const NODE_POSITIONS = [0.3, 0.72, 0.38, 0.72, 0.3];
const ROW_HEIGHT = 160;
const LANE_WIDTH = 160;

export default function ToneCoursePath({ progress, currentUnitId, suffix }: {
  progress: CourseProgress;
  currentUnitId: string | null;
  suffix: string;
}) {
  const nodes = COURSE_UNITS.map((unit, index) => {
    const mastered = unitMasteredCount(unit.activities, progress);
    return { unit, mastered, complete: mastered === unit.activities.length, x: NODE_POSITIONS[index % NODE_POSITIONS.length] };
  });
  const connector = nodes.map((node, index) => {
    const x = node.x * LANE_WIDTH;
    const y = index * ROW_HEIGHT + ROW_HEIGHT / 2;
    if (index === 0) return `M ${x} ${y}`;
    const previous = nodes[index - 1];
    const previousY = y - ROW_HEIGHT;
    return `C ${previous.x * LANE_WIDTH} ${previousY + ROW_HEIGHT / 2}, ${x} ${y - ROW_HEIGHT / 2}, ${x} ${y}`;
  }).join(" ");

  return <nav aria-label="Tone Mastery units" className={styles.path}>
    <svg aria-hidden="true" focusable="false" className={styles.connector}
      viewBox={`0 0 ${LANE_WIDTH} ${nodes.length * ROW_HEIGHT}`} preserveAspectRatio="none">
      <path d={connector} fill="none" stroke="var(--lingo-border)" strokeWidth="4" vectorEffect="non-scaling-stroke" />
    </svg>
    <ol className={styles.units}>
      {nodes.map(({ unit, mastered, complete, x }, index) => {
        const current = !complete && unit.id === currentUnitId;
        const state = complete ? "complete" : current ? "current" : "upcoming";
        const Icon = complete ? Check : UNIT_ICONS[index % UNIT_ICONS.length];
        return <li key={unit.id} className={styles.row} style={{ "--step-x": x } as CSSProperties}>
          <Link href={`/app/pronunciation/learn/${unit.id}${suffix}`} className={styles.lesson}
            aria-current={current ? "step" : undefined} data-unit-id={unit.id} data-state={state}>
            <span className={styles.node} aria-hidden="true" data-state={state}>
              <Icon size={30} strokeWidth={complete ? 3 : 2} />
            </span>
            <span className={styles.label}>
              {current && <span className={styles.continue}>Continue here</span>}
              <span className="block font-bold leading-snug text-[var(--lingo-navy)]">{unit.title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-[var(--lingo-text-muted)]">
                {complete ? "Unit complete · Revisit" : `${mastered} / ${unit.activities.length} activities complete`}
              </span>
            </span>
          </Link>
        </li>;
      })}
    </ol>
  </nav>;
}
