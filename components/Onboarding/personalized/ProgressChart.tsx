"use client";

import type { Progress } from "@/lib/onboarding/personalized/progress";

const LEFT = 44;
const RIGHT = 296;
const TOP = 34;
const BOTTOM = 150;

/**
 * "Words you know" from today to the end of the plan. All text sits on the
 * axes; nothing is written inside the plot (it's hard to read at phone size).
 * The curve shape is fixed: the numbers and week labels carry the meaning.
 */
export function ProgressChart({ progress, area = false, showNumbers = true }: { progress: Progress; area?: boolean; showNumbers?: boolean }) {
  const [w1, w2, w3] = progress.weeks;
  const eventX = progress.event ? LEFT + (Math.min(progress.event.week, w3) / w3) * (RIGHT - LEFT) : null;
  const ticks = [...progress.ticks].reverse();
  const label = showNumbers
    ? `Words you know rise from ${progress.ticks[0]} today to ${progress.ticks[3]} by week ${w3}`
    : `The words you know rise steadily from today to week ${w3}`;
  return (
    <svg viewBox="0 0 318 184" className="block h-auto w-full" role="img" aria-label={label} data-testid="progress-chart">
      <text x="0" y="12" fontSize="11" fontWeight="700" fill="#4F6E83">
        Words you know
      </text>
      {area ? <path d="M44 150 C 85 148, 110 128, 129 121 S 190 88, 215 77 S 272 40, 296 34 L 296 150 Z" fill="#EAF4EF" data-testid="progress-area" /> : null}
      {[TOP, 72, 111].map((y) => (
        <line key={y} x1={LEFT} y1={y} x2={304} y2={y} stroke="#EDF3F7" strokeWidth="1" />
      ))}
      <line x1={LEFT} y1={BOTTOM} x2={304} y2={BOTTOM} stroke="#DCE7EF" strokeWidth="1.5" />
      {showNumbers && ticks.map((value, index) => (
        <text key={index} x="36" y={[38, 76, 115, 154][index]} textAnchor="end" fontSize="11" fontWeight="500" fill="#4F6E83" data-testid="progress-tick">
          {value}
        </text>
      ))}
      <path
        d="M44 150 C 85 148, 110 128, 129 121 S 190 88, 215 77 S 272 40, 296 34"
        fill="none"
        stroke="#20674F"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {eventX !== null ? (
        <g aria-hidden="true" data-testid="progress-event-flag">
          <line x1={eventX} y1={BOTTOM} x2={eventX} y2={BOTTOM - 22} stroke="#D9735A" strokeWidth="2" strokeLinecap="round" />
          <path d={`M${eventX} ${BOTTOM - 22} l11 4 l-11 4 z`} fill="#D9735A" />
        </g>
      ) : null}
      <circle cx="44" cy="150" r="7" fill="#FFFFFF" stroke="#D9735A" strokeWidth="3" />
      <circle cx="129" cy="121" r="5" fill="#20674F" />
      <circle cx="215" cy="77" r="5" fill="#20674F" />
      <circle cx="296" cy="34" r="9" fill="#20674F" />
      <path d="M291 34 l4 4 l7 -8" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <text x="44" y="176" textAnchor="middle" fontSize="12" fontWeight="700" fill="#4F6E83">
        Today
      </text>
      <text x="129" y="176" textAnchor="middle" fontSize="12" fontWeight="700" fill="#4F6E83">
        Wk {w1}
      </text>
      <text x="215" y="176" textAnchor="middle" fontSize="12" fontWeight="700" fill="#4F6E83">
        Wk {w2}
      </text>
      <text x="304" y="176" textAnchor="end" fontSize="12" fontWeight="700" fill="#20674F">
        Wk {w3}
      </text>
    </svg>
  );
}
