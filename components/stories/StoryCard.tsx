"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { capybaraStorySrc } from "@/lib/capybaraStories";
import { hskLabelForCefr } from "@/lib/levelBands";

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

function getTimeLabel(storyText: string | null | undefined, minLabel: string) {
  if (!storyText) return `2-3 ${minLabel}`;
  const minutes = Math.min(4, Math.max(2, Math.round(storyText.length / 350)));
  return `${minutes}-${minutes + 1} ${minLabel}`;
}

export default function StoryCard({ story }: { story: StorySummary }) {
  const { convertText } = useCharacterSet();
  const { t } = useLanguage();
  const dateLabel = formatDate(story.date || story.created_at);
  const thumb = capybaraStorySrc(story.id);

  return (
    <Link
      href={`/app/story/${story.id}`}
      className="group block rounded-[20px] border bg-white p-3 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:[box-shadow:var(--lingo-shadow-card)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      style={{
        borderColor: "var(--lingo-border)",
        boxShadow: "var(--lingo-shadow-sm)",
      }}
    >
      <div className="relative h-[110px] overflow-hidden rounded-xl">
        <div className="relative h-full w-full transition-transform duration-300 ease-out group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
          <Image
            src={thumb}
            alt=""
            fill
            className="object-cover object-center"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
      </div>
      <div className="px-0.5 pt-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-(--lingo-navy)">
            {convertText(story.title)}
          </h3>
          <ChevronRight
            size={16}
            className="mt-0.5 shrink-0 text-(--lingo-blue) transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
            aria-hidden
          />
        </div>
        {story.story_zh ? (
          <p className="mt-1 line-clamp-1 text-sm text-(--lingo-text-muted)">
            {convertText(story.story_zh)}
          </p>
        ) : null}
        <p className="mt-1.5 truncate text-[12px] text-(--lingo-text-muted)">
          {[hskLabelForCefr(story.level), dateLabel, getTimeLabel(story.story_zh, t("min"))]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </Link>
  );
}
