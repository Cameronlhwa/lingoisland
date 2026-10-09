"use client";

import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import {
  buttonPrimaryClass,
  cardBaseClass,
  cardHoverClass,
} from "@/components/app/ui/styles";
import { capybaraStorySrc } from "@/lib/capybaraStories";
import { getLocalDateKey } from "@/lib/utils/date";
import { hskLabelForCefr } from "@/lib/levelBands";

export type DailyStorySummary = {
  id: string;
  title: string;
  title_en: string | null;
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

  if (variant === "stories") {
    const href = story ? `/app/story/${story.id}` : previewHref;
    return (
      <div
        className="relative overflow-hidden rounded-[28px]"
        style={{
          background:
            "linear-gradient(95deg, #e8f6fb 0%, var(--lingo-sky-pale) 42%, #f7fcfe 68%)",
          boxShadow: "var(--lingo-shadow-sm)",
        }}
      >
        <div className="relative z-10 flex flex-col sm:min-h-[252px] sm:flex-row">
          <div className="flex w-full flex-col justify-center px-6 py-8 sm:max-w-[54%] sm:px-10 sm:py-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-(--lingo-blue)">
              {convertText(t("Today's story"))}
            </p>
            {story ? (
              <>
                <h2 className="lingo-display mt-2 text-2xl font-bold text-(--lingo-navy) md:text-[30px]">
                  {convertText(story.title)}
                </h2>
                <p className="mt-2 line-clamp-2 max-w-md text-sm leading-relaxed text-(--lingo-text-muted) md:text-base">
                  {convertText(story.story_zh)}
                </p>
              </>
            ) : (
              <>
                <h2 className="lingo-display mt-2 text-2xl font-bold text-(--lingo-navy) md:text-[30px]">
                  {loading
                    ? convertText(t("Generating..."))
                    : convertText(t("Today's story is on the way."))}
                </h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-(--lingo-text-muted) md:text-base">
                  {convertText(t("Review words you've been learning in a short story built for today."))}
                </p>
              </>
            )}
            <Link
              href={href}
              onClick={onRead}
              className="mt-6 inline-flex w-fit rounded-2xl bg-(--lingo-blue) px-6 py-2.5 text-sm font-bold text-white shadow-xs transition-colors hover:bg-(--lingo-blue-bright)"
            >
              {convertText(t("Read"))}
            </Link>
          </div>
          <div className="relative h-44 w-full sm:absolute sm:inset-y-0 sm:right-0 sm:h-auto sm:w-[50%]">
            <Image
              src={capybaraStorySrc(story?.id ?? "daily")}
              alt=""
              fill
              priority
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover object-[62%_42%]"
            />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 hidden w-24 sm:block"
              style={{
                background:
                  "linear-gradient(90deg, #e8f6fb 0%, rgba(232,246,251,0.55) 46%, rgba(232,246,251,0) 100%)",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  const containerClass = `${cardBaseClass} ${cardHoverClass} h-full p-5 md:p-6 flex flex-col`;

  return (
    <div className={containerClass}>
      <div className="mb-3 md:mb-4">
        <h2 className="text-lg md:text-xl font-semibold text-gray-900">
          {convertText(t("Read your Daily Story"))}
        </h2>
      </div>
      {story ? (
        <div className="flex flex-1 flex-col gap-2 md:gap-3">
          <span className="text-xs md:text-sm text-gray-500">
            {convertText(t("Review words you've recently learned in a short story."))}
          </span>
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
            <span className="rounded-full border border-slate-200 bg-white px-2 md:px-2.5 py-0.5 md:py-1 text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-700">
              {hskLabelForCefr(story.level)}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2 md:px-2.5 py-0.5 md:py-1 text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-700">
              {timeLabel}
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-2 md:px-2.5 py-0.5 md:py-1 text-[10px] md:text-xs font-semibold uppercase tracking-wide text-gray-700">
              {convertText(t("Today"))}
            </span>
          </div>
          <h3 className="text-base md:text-lg font-semibold text-gray-900">{convertText(story.title)}</h3>
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
          <Link
            href={`/app/story/${story.id}`}
            className={`${buttonPrimaryClass} mt-auto w-fit`}
            onClick={onRead}
          >
            {convertText(t("Read"))}
          </Link>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-start gap-3 text-sm text-gray-600">
          <span>{convertText(t("Review your vocab in a short story."))}</span>
          <span>
            {loading ? convertText(t("Generating...")) : convertText(t("Today's story is on the way."))}
          </span>
          <Link
            href={previewHref}
            className={`${buttonPrimaryClass} mt-auto w-fit`}
            onClick={onRead}
          >
            {convertText(t("Read"))}
          </Link>
        </div>
      )}
    </div>
  );
}
