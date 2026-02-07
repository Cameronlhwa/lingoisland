"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import {
  buttonPrimaryClass,
  cardBaseClass,
  cardHoverClass,
} from "@/components/app/ui/styles";

export default function CreateIslandCard({
  onCreate,
}: {
  onCreate: () => void;
}) {
  const { t } = useLanguage();

  return (
    <div
      className={`${cardBaseClass} ${cardHoverClass} w-full p-5 md:p-6 text-left`}
    >
      <div className="flex flex-col gap-4 md:gap-6">
        <div>
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">
            {t("Create a Topic Island")}
          </h2>
        </div>

        <div className="flex flex-col gap-2 md:gap-3">
          <p className="text-sm md:text-base font-medium text-gray-900">
            {t("2 min setup → instant vocab + examples")}
          </p>
          <p className="text-xs md:text-sm text-gray-600">
            {t("Pick a topic. Learn words you'll actually use.")}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onCreate}
            className={`${buttonPrimaryClass} gap-2`}
          >
            {t("Create")}
            <svg viewBox="0 0 24 24" className="h-4 w-4">
              <path
                fill="currentColor"
                d="M5 12h12.17l-3.59 3.59L15 17l6-6-6-6-1.41 1.41L17.17 11H5v1z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
