"use client";

import Image from "next/image";
import { STAGE_THRESHOLDS } from "@/lib/huahua";
const STAGE_LABELS = [
  "",
  "Bare land",
  "Foundation",
  "Walls up",
  "Roof on",
  "Home complete",
];
const NEXT_LABELS = ["", "Foundation", "Walls up", "Roof on", "Home complete", null];

export default function CapybaraStrip({
  stage,
  totalReviews,
}: {
  stage: number;
  totalReviews: number;
}) {
  const safeStage = Math.min(5, Math.max(1, stage || 1));
  const nextThreshold = safeStage < 5 ? STAGE_THRESHOLDS[safeStage] : null;
  const prevThreshold = STAGE_THRESHOLDS[safeStage - 1] ?? 0;
  const reviewsUntilNext = nextThreshold
    ? Math.max(0, nextThreshold - totalReviews)
    : 0;
  // Progress within the current stage only (not from 0)
  const stageRange = nextThreshold ? nextThreshold - prevThreshold : 1;
  const stageProgress = nextThreshold
    ? Math.min(100, ((totalReviews - prevThreshold) / stageRange) * 100)
    : 100;

  const isComplete = safeStage === 5;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 p-3">
      {/* Stage island image */}
      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-amber-200">
        <Image
          src={`/progress-islands/stage-${safeStage}.png`}
          alt={`华华's island — Stage ${safeStage}: ${STAGE_LABELS[safeStage]}`}
          fill
          className="object-cover"
          sizes="56px"
        />
      </div>

      {/* Info + progress */}
      <div className="min-w-0 flex-1">
        {/* Top row: title + stage badge + next stage */}
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-gray-800">华华&apos;s Island</span>
          <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-800">
            Stage {safeStage}: {STAGE_LABELS[safeStage]}
          </span>
          {NEXT_LABELS[safeStage] ? (
            <>
              <span className="text-xs text-gray-400">→</span>
              <span className="text-xs text-gray-500">{NEXT_LABELS[safeStage]}</span>
            </>
          ) : null}
        </div>

        {/* Progress bar */}
        {!isComplete ? (
          <div className="flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-amber-100">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-500"
                style={{ width: `${stageProgress}%` }}
              />
            </div>
            <span className="flex-shrink-0 text-xs tabular-nums text-gray-400">
              {totalReviews - prevThreshold} / {stageRange}
            </span>
          </div>
        ) : (
          <p className="text-xs font-medium text-amber-700">华华 is home! 🎉</p>
        )}
      </div>

      {/* Right label */}
      {!isComplete ? (
        <p className="hidden flex-shrink-0 text-xs font-medium text-amber-700 sm:block">
          {reviewsUntilNext} more {reviewsUntilNext === 1 ? "review" : "reviews"} →
        </p>
      ) : null}
    </div>
  );
}
