"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardBaseClass,
  cardHoverClass,
} from "@/components/app/ui/styles";

export default function HeroContinueCard({
  chips,
  onStart,
  chooseHref = "/app/topic-islands",
  nextUpText,
}: {
  chips: string[];
  onStart: () => void;
  chooseHref?: string;
  nextUpText?: string;
}) {
  const { t } = useLanguage();
  const nextUpLabel =
    nextUpText ?? `${t("Next")}: ${t("Flashcards")} · 2 ${t("min")} · 12 ${t("due")}`;

  return (
    <div
      className={`${cardBaseClass} ${cardHoverClass} group relative overflow-hidden p-8`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/70 via-white to-white opacity-80 transition-opacity group-hover:opacity-100" />
      <div className="relative flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {t("Continue learning")}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t("A quick session to keep your streak going.")}
          </p>
          <p className="mt-2 text-sm font-semibold text-gray-900">
            {nextUpLabel}
          </p>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.slice(0, 3).map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700"
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={onStart}
            className={buttonPrimaryClass}
          >
            {t("Start")}
          </button>
          <Link
            href={chooseHref}
            className={buttonSecondaryClass}
          >
            {t("Choose")}
          </Link>
        </div>
      </div>
    </div>
  );
}

