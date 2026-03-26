"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { cardBaseClass, cardHoverClass } from "@/components/app/ui/styles";

export default function CreateIslandCard({
  onCreate,
  onBrowse,
}: {
  onCreate: () => void;
  onBrowse?: (e: React.MouseEvent) => void;
}) {
  const { t } = useLanguage();

  return (
    <div
      className={`${cardBaseClass} ${cardHoverClass} w-full h-full p-5 md:p-6 text-left flex flex-col`}
    >
      <div className="flex h-full flex-col gap-4">
        {/* Title + pill */}
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">
            {t("Create a Topic Island")}
          </h2>
          <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            {t("2 min setup")}
          </span>
        </div>

        {/* Supporting + muted copy */}
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-gray-700">
            {t("Instant vocab + examples at your level.")}
          </p>
          <p className="text-xs text-gray-500">
            {t("Pick a topic. Learn words you'll actually use.")}
          </p>
        </div>

        {/* CTAs: single primary + link row + helper */}
        <div className="mt-auto flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={onCreate}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#0B1B3A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0f2744] focus:outline-none focus:ring-2 focus:ring-[#0B1B3A] focus:ring-offset-2"
          >
            {t("Create Topic Island →")}
          </button>
          <Link
            href="/app/browse-topics"
            onClick={onBrowse}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[#0B1B3A]/85 transition-colors hover:text-[#0B1B3A] hover:underline focus:outline-none focus:ring-2 focus:ring-[#0B1B3A] focus:ring-offset-2 rounded"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            {t("Browse for inspiration →")}
            <span aria-hidden>→</span>
          </Link>
          <p className="text-xs text-gray-500">
            {t("No topic in mind? Explore popular topics and get inspired.")}
          </p>
        </div>
      </div>
    </div>
  );
}
