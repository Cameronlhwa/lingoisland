"use client";

import Link from "next/link";

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
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
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
  const today = new Date().toISOString().slice(0, 10);

  const dateLabel = formatDate(story?.date || story?.created_at || today);
  const containerClass =
    variant === "home"
      ? "rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      : "rounded-2xl border border-gray-200 bg-gray-50 p-6";

  return (
    <div className={containerClass}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Today's story</h2>
        <span className="text-sm text-gray-500">{dateLabel}</span>
      </div>
      {story ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
              {story.level}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">
            {story.title}
          </h3>
          <p
            className="text-sm text-gray-600"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {story.story_zh}
          </p>
          <Link
            href={`/app/story/${story.id}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 hover:text-gray-700"
          >
            Read →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3 text-sm text-gray-600">
          <span>
            {loading ? "Generating..." : "Today's story is on the way."}
          </span>
          <Link
            href={previewHref}
            className="rounded-lg border border-gray-900 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-50"
          >
            Open today&apos;s story
          </Link>
        </div>
      )}
    </div>
  );
}
