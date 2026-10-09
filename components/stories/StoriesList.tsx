"use client";

import Image from "next/image";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import StoryCard, { type StorySummary } from "./StoryCard";

export default function StoriesList({ stories }: { stories: StorySummary[] }) {
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();
  if (stories.length === 0) {
    return (
      <div
        className="mx-auto flex max-w-md flex-col items-center rounded-[24px] border bg-white px-6 py-10 text-center"
        style={{
          borderColor: "var(--lingo-border)",
          boxShadow: "var(--lingo-shadow-sm)",
        }}
      >
        <div className="relative mb-4 h-28 w-full max-w-[200px] overflow-hidden rounded-2xl">
          <Image
            src="/capybara-stories/sunset.jpg"
            alt=""
            fill
            className="object-cover object-center"
            sizes="200px"
          />
        </div>
        <p className="text-sm text-(--lingo-text-muted)">
          {convertText(t("No stories yet. Create a custom story or generate today's story."))}
        </p>
        <Link
          href="/app/stories/new"
          className="mt-5 inline-flex items-center justify-center rounded-2xl bg-(--lingo-navy) px-5 py-3 text-sm font-bold text-white shadow-xs transition-colors hover:bg-(--lingo-navy-soft)"
        >
          {convertText(t("Create New Story"))}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {stories.map((story) => (
        <StoryCard key={story.id} story={story} />
      ))}
    </div>
  );
}
