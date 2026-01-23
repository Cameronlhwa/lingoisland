"use client";

import Link from "next/link";

export type StorySummary = {
  id: string;
  title: string;
  level: string;
  kind: "daily" | "custom";
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

export default function StoryCard({ story }: { story: StorySummary }) {
  const label = story.kind === "daily" ? "Daily" : "Custom";
  const badgeTone =
    story.kind === "daily"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-gray-200 bg-gray-100 text-gray-700";
  const dateLabel = formatDate(story.date || story.created_at);

  return (
    <Link
      href={`/app/story/${story.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-900 hover:bg-gray-50 hover:shadow-md"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-gray-600">
          {story.level} {dateLabel ? `• ${dateLabel}` : ""}
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${badgeTone}`}
        >
          {label}
        </span>
      </div>
      <h3 className="mb-2 text-lg font-semibold text-gray-900">
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
    </Link>
  );
}

