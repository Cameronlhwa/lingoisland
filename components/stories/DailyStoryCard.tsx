"use client";

import Link from "next/link";
import {
  buttonPrimaryClass,
  cardBaseClass,
  cardHoverClass,
} from "@/components/app/ui/styles";
import { getLocalDateKey } from "@/lib/utils/date";

export type DailyStorySummary = {
  id: string;
  title: string;
  level: string;
  date: string | null;
  created_at: string;
  story_zh: string;
};

function formatDate(value: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(year, month - 1, day);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

function getTimeLabel(storyText: string | null | undefined) {
  if (!storyText) return "2-3 min";
  const minutes = Math.min(4, Math.max(2, Math.round(storyText.length / 350)));
  return `${minutes}-${minutes + 1} min`;
}

export default function DailyStoryCard({
  story,
  variant,
  previewHref = "/app/story/daily",
  loading = false,
}: {
  story: DailyStorySummary | null;
  variant: "home" | "stories";
  previewHref?: string;
  loading?: boolean;
}) {
  const today = getLocalDateKey();

  const dateLabel = formatDate(story?.date || story?.created_at || today);
  const timeLabel = getTimeLabel(story?.story_zh);
  const containerClass =
    variant === "home"
      ? `${cardBaseClass} ${cardHoverClass} p-6`
      : "rounded-2xl border border-gray-200 bg-gray-50 p-6";

  return (
    <div className={containerClass}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
            <svg viewBox="0 0 24 24" className="h-4 w-4">
              <path
                fill="currentColor"
                d="M5 4h12a2 2 0 012 2v13l-3-2-3 2-3-2-3 2-2-1.4V6a2 2 0 012-2z"
              />
            </svg>
          </span>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Daily story</h2>
            <span className="text-xs text-gray-500">{dateLabel}</span>
          </div>
        </div>
      </div>
      {story ? (
        <div className="space-y-3">
          {variant === "home" && (
            <p className="text-sm text-gray-600">
              Review your vocab in a short story.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
              {story.level}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
              {timeLabel}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
              Today
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{story.title}</h3>
          {variant === "home" && (
            <p
              className="text-sm text-gray-600"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {story.story_zh}
            </p>
          )}
          <Link href={`/app/story/${story.id}`} className={buttonPrimaryClass}>
            Read
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3 text-sm text-gray-600">
          {variant === "home" && (
            <span>Review your vocab in a short story.</span>
          )}
          <span>
            {loading ? "Generating..." : "Today's story is on the way."}
          </span>
          <Link href={previewHref} className={buttonPrimaryClass}>
            Read
          </Link>
        </div>
      )}
    </div>
  );
}
