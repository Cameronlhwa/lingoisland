"use client";

const STAGE_THRESHOLDS = [0, 10, 25, 50, 90];
const STAGE_LABELS = [
  "",
  "Bare land",
  "Foundation",
  "Walls up",
  "Roof on",
  "Home complete 🏠",
];
const NEXT_LABELS = ["", "Foundation", "Walls up", "Roof on", "Home complete 🏠", null];

export default function CapybaraStrip({
  stage,
  totalReviews,
}: {
  stage: number;
  totalReviews: number;
}) {
  const safeStage = Math.min(5, Math.max(1, stage || 1));
  const nextThreshold = safeStage < 5 ? STAGE_THRESHOLDS[safeStage] : null;
  const reviewsUntilNext = nextThreshold
    ? Math.max(0, nextThreshold - totalReviews)
    : 0;
  const pct = nextThreshold
    ? Math.min(100, (totalReviews / nextThreshold) * 100)
    : 100;

  return (
    <div className="mb-4 flex items-center gap-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
      <span className="flex-shrink-0 text-2xl">🦫</span>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">华华&apos;s Island</span>
          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-600">
            Stage {safeStage}: {STAGE_LABELS[safeStage]}
          </span>
          {NEXT_LABELS[safeStage] ? (
            <>
              <span className="text-xs text-gray-400">→</span>
              <span className="text-xs text-gray-500">{NEXT_LABELS[safeStage]}</span>
            </>
          ) : null}
        </div>
        {nextThreshold ? (
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 rounded-full border border-amber-200 bg-white">
              <div
                className="h-1.5 rounded-full bg-amber-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="flex-shrink-0 text-xs text-gray-400">
              {totalReviews} / {nextThreshold}
            </span>
          </div>
        ) : null}
      </div>
      {safeStage < 5 ? (
        <p className="hidden flex-shrink-0 text-xs font-medium text-amber-700 sm:block">
          {reviewsUntilNext} more review{reviewsUntilNext === 1 ? "" : "s"} to
          help him build →
        </p>
      ) : (
        <p className="flex-shrink-0 text-xs font-medium text-amber-700">
          华华 is home! 🎉
        </p>
      )}
    </div>
  );
}
