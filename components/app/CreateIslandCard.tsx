"use client";

import { useState } from "react";
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
  const suggestedTopics = ["Dating", "Driving", "Work"];
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const { t } = useLanguage();

  return (
    <div
      className={`${cardBaseClass} ${cardHoverClass} group relative w-full overflow-hidden p-6 text-left`}
    >
      <div className="create-island-bg" aria-hidden="true" />
      <div className="create-island-shine" aria-hidden="true" />

      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-100 bg-white/80 text-blue-600 shadow-sm">
            <svg viewBox="0 0 24 24" className="h-4 w-4">
              <path
                fill="currentColor"
                d="M12 4l2.1 4.3L19 10l-4.9 1.7L12 16l-2.1-4.3L5 10l4.9-1.7L12 4z"
              />
            </svg>
          </span>
          {t("Topic Islands")}
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {t("Create a Topic Island")}
          </h2>
          <p className="mt-1 text-sm font-semibold text-gray-900">
            {t("2 min setup → instant vocab + examples")}
          </p>
          <p className="mt-2 text-sm text-gray-600">
            {t("Pick a topic. Learn words you'll actually use.")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {suggestedTopics.map((topic) => {
            const isSelected = selectedTopic === topic;
            return (
              <button
                key={topic}
                type="button"
                onClick={() => setSelectedTopic(topic)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  isSelected
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {t(topic)}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {t("Suggested topics")}
          </span>
          <button
            type="button"
            onClick={onCreate}
            className={`${buttonPrimaryClass} create-island-cta gap-2`}
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

      <style jsx>{`
        .create-island-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(140deg, #f8fafc 0%, #eef6ff 55%, #ffffff 100%);
          opacity: 0.9;
          pointer-events: none;
        }

        .create-island-shine {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            120deg,
            transparent 30%,
            rgba(59, 130, 246, 0.15),
            transparent 70%
          );
          transform: translateX(-130%);
          opacity: 0.35;
          animation: island-shine 7s ease-in-out infinite;
          pointer-events: none;
        }

        .create-island-cta {
          position: relative;
        }

        .create-island-cta::after {
          content: "";
          position: absolute;
          inset: -6px;
          border-radius: 12px;
          background: radial-gradient(circle, rgba(59, 130, 246, 0.2), transparent 65%);
          opacity: 0.4;
          animation: island-pulse 3s ease-in-out infinite;
          z-index: -1;
        }

        .group:hover .create-island-cta::after {
          opacity: 0.6;
        }

        @keyframes island-shine {
          0%,
          100% {
            transform: translateX(-130%);
          }
          50% {
            transform: translateX(130%);
          }
        }

        @keyframes island-pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.06);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .create-island-shine,
          .create-island-cta::after {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

