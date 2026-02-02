"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
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
  const { convertText } = useCharacterSet();
  const nextUpLabel =
    nextUpText ??
    `${t("Next")}: ${t("Flashcards")} · 2 ${t("min")} · 12 ${t("due")}`;

  return (
    <div
      className={`${cardBaseClass} ${cardHoverClass} group relative overflow-hidden p-5 md:p-8`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/70 via-white to-white opacity-80 transition-opacity group-hover:opacity-100" />
      <div className="relative flex flex-col gap-3 md:gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">
            {convertText(t("Continue learning"))}
          </h1>
          <p className="mt-1 text-xs md:text-sm text-gray-600">
            {convertText(t("A quick session to keep your streak going."))}
          </p>
          <p className="mt-2 text-xs md:text-sm font-semibold text-gray-900">
            {convertText(nextUpLabel)}
          </p>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.slice(0, 3).map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700"
              >
                {convertText(chip)}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={onStart} className={buttonPrimaryClass}>
            {convertText(t("Start"))}
          </button>
          <Link href={chooseHref} className={buttonSecondaryClass}>
            {convertText(t("Choose"))}
          </Link>
        </div>
      </div>
    </div>
  );
}
