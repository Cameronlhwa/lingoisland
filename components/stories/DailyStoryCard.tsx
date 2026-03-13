"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
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

function getTimeLabel(storyText: string | null | undefined, minLabel: string) {
  if (!storyText) return `2-3 ${minLabel}`;
  const minutes = Math.min(4, Math.max(2, Math.round(storyText.length / 350)));
  return `${minutes}-${minutes + 1} ${minLabel}`;
}

export default function DailyStoryCard({
  story,
  variant,
  previewHref = "/app/story/daily",
  loading = false,
  onRead,
}: {
  story: DailyStorySummary | null;
  variant: "home" | "stories";
  previewHref?: string;
  loading?: boolean;
  onRead?: (e: React.MouseEvent) => void;
}) {
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();
  const today = getLocalDateKey();

  const dateLabel = formatDate(story?.date || story?.created_at || today);
  const timeLabel = getTimeLabel(story?.story_zh, convertText(t("min")));
  const containerClass =
    variant === "home"
      ? `${cardBaseClass} ${cardHoverClass} p-5 md:p-6`
      : "rounded-2xl border border-gray-200 bg-gray-50 p-5 md:p-6";

  return (
    <div className={containerClass}>
      <div className="mb-3 md:mb-4">
        <h2 className="text-lg md:text-xl font-semibold text-gray-900">
          {convertText(t("Read your Daily Story"))}
        </h2>
      </div>
      {story ? (
        <div className="space-y-2 md:space-y-3">
          {variant === "home" && (
            <span className="text-xs md:text-sm text-gray-500">
              {convertText(t("Review words you've recently learned in a short story."))}
            </span>
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span className="rounded-full border border-slate-200 bg-white px-2 md:px-2.5 py-0.5 md:py-1 text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-700">
              {story.level}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2 md:px-2.5 py-0.5 md:py-1 text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-700">
              {timeLabel}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2 md:px-2.5 py-0.5 md:py-1 text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-700">
              {convertText(t("Today"))}
            </span>
          </div>
          <h3 className="text-base md:text-lg font-semibold text-gray-900">{convertText(story.title)}</h3>
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
              {convertText(story.story_zh)}
            </p>
          )}
          <Link href={`/app/story/${story.id}`} className={buttonPrimaryClass} onClick={onRead}>
            {convertText(t("Read"))}
          </Link>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3 text-sm text-gray-600">
          {variant === "home" && (
            <span>{convertText(t("Review your vocab in a short story."))}</span>
          )}
          <span>
            {loading ? convertText(t("Generating...")) : convertText(t("Today's story is on the way."))}
          </span>
          <Link href={previewHref} className={buttonPrimaryClass} onClick={onRead}>
            {convertText(t("Read"))}
          </Link>
        </div>
      )}
    </div>
  );
}
