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

      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5zM16.5 15a.75.75 0 01.712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 010 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 01-1.422 0l-.395-1.183a1.5 1.5 0 00-.948-.948l-1.183-.395a.75.75 0 010-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0116.5 15z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          <h2 className="text-xl font-semibold text-gray-900">
            {t("Create a Topic Island")}
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-base font-medium text-gray-900">
            {t("2 min setup → instant vocab + examples")}
          </p>
          <p className="text-sm text-gray-600">
            {t("Pick a topic. Learn words you'll actually use.")}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {suggestedTopics.map((topic) => {
              const isSelected = selectedTopic === topic;
              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setSelectedTopic(topic)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                    isSelected
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {t(topic)}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between">
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
      </div>

      <style jsx>{`
        .create-island-bg {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            140deg,
            #f8fafc 0%,
            #eef6ff 55%,
            #ffffff 100%
          );
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
          background: radial-gradient(
            circle,
            rgba(59, 130, 246, 0.2),
            transparent 65%
          );
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
