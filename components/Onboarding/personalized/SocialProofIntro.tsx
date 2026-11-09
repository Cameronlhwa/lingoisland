"use client";

import { useMemo } from "react";
import { Star } from "lucide-react";
import type { OnboardingAnswers } from "@/lib/onboarding/personalized/flow";
import { matchReviews, RATING_NOTE, SITE_RATING, socialProofTitle } from "@/lib/onboarding/personalized/socialProof";
import { CARD_BORDER, FONT_DISPLAY, GREEN, MUTED, NAVY, PrimaryButton, SKY_PALE, StepFrame } from "./ui";

const STAR_COLOR = "#F5A524";
const LEAF_COLOR = "#A9BCCB";
/** Desktop cards step up from left to right. */
const STAGGER = ["sm:mt-8", "sm:mt-4", "sm:mt-0"];

function Stars({ rating }: { rating: number }) {
  const row = (filled: boolean) =>
    Array.from({ length: 5 }, (_, index) => (
      <Star key={index} size={22} strokeWidth={1.6} color={STAR_COLOR} fill={filled ? STAR_COLOR : "none"} className="shrink-0" />
    ));
  return (
    <span className="relative inline-flex" aria-hidden>
      <span className="flex gap-1">{row(false)}</span>
      <span className="absolute inset-y-0 left-0 flex gap-1 overflow-hidden" style={{ width: `${(rating / 5) * 100}%` }}>
        {row(true)}
      </span>
    </span>
  );
}

const LEAVES: Array<[number, number, number]> = [
  [12.5, 40, -55],
  [9, 32, -38],
  [7.5, 23.5, -22],
  [8, 15, -6],
  [10.5, 7.5, 12],
  [17.5, 36, 38],
  [14, 27, 26],
  [13, 18, 14],
];

function Laurel({ flip = false }: { flip?: boolean }) {
  return (
    <svg width="26" height="48" viewBox="0 0 26 48" aria-hidden style={flip ? { transform: "scaleX(-1)" } : undefined}>
      <path d="M21 46 C9 39 6 24 11 4" stroke={LEAF_COLOR} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      {LEAVES.map(([cx, cy, rotate]) => (
        <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx="2.4" ry="5" transform={`rotate(${rotate} ${cx} ${cy})`} fill={LEAF_COLOR} />
      ))}
    </svg>
  );
}

export function SocialProofIntro({
  answers,
  progress,
  onBack,
  onContinue,
}: {
  answers: OnboardingAnswers;
  progress: { index: number; total: number };
  onBack: (() => void) | null;
  onContinue: () => void;
}) {
  const reviews = useMemo(() => matchReviews(answers), [answers]);

  return (
    <StepFrame title={socialProofTitle(answers.goal.primary)} progress={progress} onBack={onBack}>
      <div className="flex flex-col items-center text-center" data-testid="site-rating">
        <div className="flex items-center gap-3">
          <Laurel />
          <div>
            <p className="text-[17px] font-bold" style={{ fontFamily: FONT_DISPLAY, color: NAVY }}>
              Rated {SITE_RATING} out of 5
            </p>
            <div className="mt-1 flex justify-center">
              <Stars rating={SITE_RATING} />
            </div>
          </div>
          <Laurel flip />
        </div>
        <p className="mt-3 text-sm" style={{ color: MUTED }}>
          Reviews picked for you, based on what you told us
        </p>
      </div>

      <div
        role="region"
        aria-label="Learner reviews"
        tabIndex={0}
        className="-mx-5 mt-5 overflow-x-auto px-5 pb-2 outline-none [scrollbar-width:none] focus-visible:ring-2 sm:mx-0 sm:overflow-visible sm:px-0"
        style={{ scrollSnapType: "x mandatory", scrollPaddingInline: 20 }}
      >
        <ul className="flex gap-3 sm:grid sm:grid-cols-3 sm:items-start">
          {reviews.map(({ testimonial, reason }, index) => (
            <li
              key={testimonial.role}
              data-testid="social-proof-review"
              className={`w-[82%] shrink-0 rounded-2xl p-4 text-left sm:w-auto ${STAGGER[index] ?? ""}`}
              style={{ background: SKY_PALE, border: `1px solid ${CARD_BORDER}`, scrollSnapAlign: "start" }}
            >
              <figure>
                <figcaption>
                  <span className="block text-[15px] font-bold" style={{ color: NAVY }}>
                    {testimonial.role}
                  </span>
                  {reason ? (
                    <span
                      className="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
                      style={{ background: "rgba(32,103,79,0.1)", color: GREEN }}
                      data-testid="social-proof-reason"
                    >
                      {reason}
                    </span>
                  ) : null}
                </figcaption>
                <blockquote className="mt-2.5 text-[14px] leading-relaxed" style={{ color: NAVY }}>
                  <p>&ldquo;{testimonial.quote}&rdquo;</p>
                </blockquote>
              </figure>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 text-center text-xs" style={{ color: MUTED }}>
        {RATING_NOTE}
      </p>
      <PrimaryButton className="mt-5" onClick={onContinue} data-testid="social-proof-continue">
        Continue
      </PrimaryButton>
    </StepFrame>
  );
}
