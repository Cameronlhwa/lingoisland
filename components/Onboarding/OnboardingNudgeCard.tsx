"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { OnboardingNudge } from "@/types/onboarding";

interface OnboardingNudgeCardProps {
  nudge: OnboardingNudge;
  onDismiss: () => void;
  onComplete: () => void;
  onCtaClick?: () => void; // Optional custom click handler for CTA
}

export default function OnboardingNudgeCard({
  nudge,
  onDismiss,
  onComplete,
  onCtaClick,
}: OnboardingNudgeCardProps) {
  const handleCtaClick = (e: React.MouseEvent) => {
    if (onCtaClick) {
      e.preventDefault();
      onCtaClick();
      return; // Don't advance to the next card when intercepted (e.g. opening signup modal)
    }
    onComplete();
  };
  
  return (
    <motion.div
      key={nudge.key}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="relative overflow-hidden rounded-lg border-2 border-gray-800 bg-gray-900 backdrop-blur-sm p-5 shadow-lg"
    >
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-3 top-3 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
          aria-label="Dismiss"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <div className="flex items-start gap-3 pr-10">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-white">{nudge.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-300">
              {nudge.body}
            </p>
            <div className="mt-4">
              <Link
                href={nudge.ctaHref}
                className="inline-flex items-center justify-center rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 transition-all hover:bg-gray-100 shadow-sm hover:shadow-md"
                onClick={handleCtaClick}
              >
                {nudge.cta}
              </Link>
            </div>
          </div>
        </div>
    </motion.div>
  );
}
