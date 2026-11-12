"use client";
import { useOnboardingVariant } from "./personalized/OnboardingExperiment";


/** Compact LingoIsland vs typical-apps progress curves for the conversation paywall. */
export default function ProgressComparisonChart({
  title,
  weeks,
  lingoLabel = "LingoIsland",
  otherLabel = "Typical apps",
}: {
  title: string;
  weeks: number;
  lingoLabel?: string;
  otherLabel?: string;
}) {
  const miniLesson = useOnboardingVariant() === "test";
  const endLabel = weeks <= 12 ? `${weeks} weeks` : `${Math.max(1, Math.round(weeks / 4.345))} months`;
  const aria = `Illustrative progress curves for ${lingoLabel} and ${otherLabel} from today to ${endLabel}; not a calculated prediction or measured comparison.`;

  return (
    <figure data-testid="conversation-comparison" className="mt-5 rounded-2xl border border-[#D7E5EE] bg-[#F7FBFD] px-3.5 pb-2.5 pt-3 text-left">
      <figcaption className="px-0.5 text-[13px] font-bold leading-snug text-[var(--lingo-navy)]">{title}</figcaption>
      <svg viewBox="0 0 320 132" className="mt-2 block h-auto w-full" role="img" aria-label={aria}>
        {[28, 56, 84].map((y) => (
          <line key={y} x1="12" y1={y} x2="308" y2={y} stroke="#E4EEF4" strokeWidth="1" />
        ))}
        <line x1="12" y1="112" x2="308" y2="112" stroke="#D5E0E8" strokeWidth="1.5" />

        {/* Typical apps: slow, flattening */}
        <path
          d={miniLesson ? "M12 108 C 50 97, 94 90, 150 89 C 206 88, 254 88, 308 88" : "M12 108 C 70 106, 120 102, 170 98 S 250 92, 308 88"}
          fill="none"
          stroke="#9AA8B5"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="5 5"
        />
        <circle cx="308" cy="88" r="4" fill="#9AA8B5" />

        {/* LingoIsland: gentle early rise, then an accelerating upward finish */}
        <path
          d={miniLesson ? "M12 108 C 64 102, 92 85, 146 75 C 200 65, 254 61, 308 18" : "M12 108 C 55 104, 95 88, 140 62 S 230 28, 308 18"}
          fill="none"
          stroke="#20674F"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path d={miniLesson ? "M12 108 C 64 102, 92 85, 146 75 C 200 65, 254 61, 308 18 L 308 112 L 12 112 Z" : "M12 108 C 55 104, 95 88, 140 62 S 230 28, 308 18 L 308 112 L 12 112 Z"} fill="rgba(32,103,79,0.08)" />
        <circle cx="12" cy="108" r="5" fill="#fff" stroke="#D9735A" strokeWidth="2.5" />
        <circle cx="308" cy="18" r="7" fill="#20674F" />
        <path d="M304 18 l3.2 3.2 l5.5 -6.2" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        <text x="12" y="128" fontSize="11" fontWeight="700" fill="#5A7A90">
          Today
        </text>
        <text x="308" y="128" textAnchor="end" fontSize="11" fontWeight="700" fill="#20674F">
          {endLabel}
        </text>
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 px-0.5 text-[12px] font-semibold">
        <span className="inline-flex items-center gap-1.5 text-[#20674F]">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded-full bg-[#20674F]" />
          {lingoLabel}
        </span>
        <span className="inline-flex items-center gap-1.5 text-[#5A7A90]">
          <span aria-hidden className="inline-block h-0.5 w-4 rounded-full border-t-2 border-dashed border-[#9AA8B5]" />
          {otherLabel}
        </span>
      </div>
    </figure>
  );
}
