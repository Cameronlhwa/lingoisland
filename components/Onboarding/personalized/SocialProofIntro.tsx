"use client";

import Image from "next/image";
import { useMemo } from "react";
import { Star } from "lucide-react";
import type { OnboardingAnswers } from "@/lib/onboarding/personalized/flow";
import { matchReviews, RATING_NOTE, reviewsTitle, SITE_RATING } from "@/lib/onboarding/personalized/socialProof";
import { CARD_BORDER, FONT_DISPLAY, GREEN, MUTED, NAVY, PrimaryButton, StepFrame } from "./ui";

const STAR_COLOR = "#F5A524";
const LEAF_COLOR = "#A9BCCB";
const CARD_SHADOW = "0 10px 28px rgba(7, 30, 46, 0.1)";
/** Desktop cards step up from left to right. */
const STAGGER = ["sm:mt-8", "sm:mt-4", "sm:mt-0"];

function Stars({ rating, size = 22 }: { rating: number; size?: number }) {
  const row = (filled: boolean) =>
    Array.from({ length: 5 }, (_, index) => (
      <Star key={index} size={size} strokeWidth={1.6} color={STAR_COLOR} fill={filled ? STAR_COLOR : "none"} className="shrink-0" />
    ));
  return (
    <span className="relative inline-flex" aria-hidden>
      <span className="flex gap-0.5">{row(false)}</span>
      <span className="absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden" style={{ width: `${(rating / 5) * 100}%` }}>
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
    <StepFrame title={reviewsTitle(answers)} progress={progress} onBack={onBack}>
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
        className="-mx-5 mt-5 overflow-x-auto px-5 pb-3 outline-none [scrollbar-width:none] focus-visible:ring-2 sm:mx-0 sm:overflow-visible sm:px-0"
        style={{ scrollSnapType: "x mandatory", scrollPaddingInline: 20 }}
      >
        <ul className="flex gap-3.5 sm:grid sm:grid-cols-3 sm:items-start sm:gap-3">
          {reviews.map(({ testimonial, reason }, index) => (
            <li
              key={testimonial.role}
              data-testid="social-proof-review"
              className={`w-[86%] shrink-0 rounded-[20px] bg-white p-4 text-left sm:w-auto sm:p-4 ${STAGGER[index] ?? ""}`}
              style={{ border: `1px solid ${CARD_BORDER}`, boxShadow: CARD_SHADOW, scrollSnapAlign: "start" }}
            >
              <figure className="flex h-full flex-col">
                <div className="flex items-center gap-1.5">
                  <Stars rating={5} size={14} />
                  <span className="sr-only">5 out of 5 stars</span>
                </div>
                <blockquote
                  className="mt-3 flex-1 text-[14.5px] leading-[1.55]"
                  style={{ fontFamily: FONT_DISPLAY, color: NAVY }}
                >
                  <p>
                    <span aria-hidden className="mr-0.5 text-[22px] font-bold leading-none" style={{ color: GREEN }}>
                      &ldquo;
                    </span>
                    {testimonial.quote}
                    <span aria-hidden>&rdquo;</span>
                  </p>
                </blockquote>
                <figcaption className="mt-4 flex items-center gap-2.5 border-t pt-3" style={{ borderColor: CARD_BORDER }}>
                  <Image
                    src={testimonial.image}
                    alt=""
                    width={44}
                    height={44}
                    className="h-11 w-11 shrink-0 rounded-full"
                  />
                  <span className="min-w-0 truncate text-[14px] font-bold" style={{ color: NAVY }}>
                    {testimonial.role}
                  </span>
                </figcaption>
                {reason ? (
                  <p className="mt-2.5 text-[12px] leading-snug" style={{ color: MUTED }} data-testid="social-proof-reason">
                    {reason}
                  </p>
                ) : null}
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
