"use client";

/**
 * HSK Flashcards review session — forked from `/app/quiz/[id]/session`.
 */

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { pinyin as pinyinPro } from "pinyin-pro";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import { useOnboarding } from "@/contexts/OnboardingContext";
import {
  useProgressIslandUpgrade,
  checkAndShowUpgrade,
} from "@/contexts/ProgressIslandUpgradeContext";
import SpeakerButton from "@/components/app/SpeakerButton";
import {
  hskFlashcardsDeck,
  useHskFlashcardsBasePath,
} from "@/components/hsk/hskFlashcardsPaths";

interface Card {
  id: string;
  front: string;
  back: string;
  pinyin: string | null;
  front_lang: string | null;
  back_lang: string | null;
  queue_bucket?: "due" | "review" | "new";
}

export default function HskFlashcardsSession({
  deckId,
}: {
  deckId: string;
}) {
  const router = useRouter();
  const basePath = useHskFlashcardsBasePath();
  const deckPath = hskFlashcardsDeck(basePath, deckId);
  const sessionCardLimit = 10;
  const { convertText } = useCharacterSet();
  const { completeNudge } = useOnboarding();
  const progressUpgrade = useProgressIslandUpgrade();

  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showPinyin, setShowPinyin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const navTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  useEffect(() => {
    return () => {
      if (navTimeoutRef.current != null) clearTimeout(navTimeoutRef.current);
    };
  }, []);

  const isChinese = (lang: string | null | undefined) =>
    typeof lang === "string" && lang.toLowerCase().startsWith("zh");
  const containsChinese = (text: string | null | undefined) =>
    typeof text === "string" && /[\u4e00-\u9fff]/.test(text);
  const getPinyinForText = (text: string | null | undefined) => {
    if (!text || !containsChinese(text)) return null;
    try {
      const result = pinyinPro(text, { toneType: "symbol" });
      return Array.isArray(result) ? result.join(" ") : result;
    } catch (error) {
      console.error("Error generating pinyin:", error);
      return null;
    }
  };

  const loadQueue = async () => {
    try {
      const response = await fetch(`/api/hsk/flashcard-decks/${deckId}/queue`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push(deckPath);
          return;
        }
        throw new Error("Failed to load queue");
      }
      const data = await response.json();
      const queue = data.cards || [];
      setCards(queue.slice(0, sessionCardLimit));
      setCurrentIndex(0);
      setShowAnswer(false);
    } catch (error) {
      console.error("Error loading queue:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGrade = async (rating: "forgot" | "hard" | "good" | "easy") => {
    if (grading) return;
    setGrading(true);

    try {
      const tzOffset = new Date().getTimezoneOffset();
      const response = await fetch(`/api/hsk/flashcard-decks/${deckId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: currentCard.id, rating, tzOffset }),
      });

      if (!response.ok) throw new Error("Failed to grade");

      const result = await response.json();
      if (
        typeof result?.huahuaTotalReviews === "number" &&
        typeof result?.huahuaStage === "number"
      ) {
        window.dispatchEvent(
          new CustomEvent("huahua-progress-updated", {
            detail: {
              totalReviews: result.huahuaTotalReviews,
              stage: result.huahuaStage,
            },
          }),
        );
      }

      let didShowUpgrade = false;
      if (typeof result?.todayCount === "number" && progressUpgrade) {
        didShowUpgrade = checkAndShowUpgrade(
          result.todayCount,
          progressUpgrade.showUpgrade,
        );
      }

      if (currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setShowAnswer(false);
      } else {
        completeNudge("try_quiz");
        if (didShowUpgrade) {
          const timeoutId = setTimeout(() => router.push(deckPath), 400);
          navTimeoutRef.current = timeoutId;
        } else {
          router.push(deckPath);
        }
      }
    } catch (error) {
      console.error("Error grading:", error);
      alert("Failed to grade card. Please try again.");
    } finally {
      setGrading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-600">
          <svg
            className="h-5 w-5 animate-spin text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <span>Loading flashcards...</span>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="mb-6 text-gray-600">No cards to review right now!</p>
          <button
            onClick={() => router.push(deckPath)}
            className="inline-block rounded-lg border border-gray-900 bg-gray-900 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800"
          >
            Back to Deck
          </button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push(deckPath)}
            className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            ← Exit Flashcards
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowPinyin((prev) => !prev)}
              className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {showPinyin ? "Hide Pinyin" : "Show Pinyin"}
            </button>
            <div className="text-sm text-gray-600">
              Card {currentIndex + 1} of {cards.length}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-12 shadow-sm">
          <div className="mb-8 text-center">
            <div className="mb-4 flex items-center justify-center gap-3">
              <div className="text-4xl font-bold text-gray-900">
                {containsChinese(currentCard.front)
                  ? convertText(currentCard.front)
                  : currentCard.front}
              </div>
              {(isChinese(currentCard.front_lang) ||
                containsChinese(currentCard.front)) && (
                <SpeakerButton text={currentCard.front} type="word" size="lg" />
              )}
            </div>

            {showPinyin &&
              (isChinese(currentCard.front_lang) ||
                containsChinese(currentCard.front)) && (
                <div className="text-lg text-gray-500">
                  {currentCard.pinyin || getPinyinForText(currentCard.front)}
                </div>
              )}
          </div>

          {!showAnswer ? (
            <div className="text-center">
              <button
                onClick={() => setShowAnswer(true)}
                className="rounded-lg border border-gray-900 bg-gray-900 px-8 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800"
              >
                Show Answer
              </button>
            </div>
          ) : (
            <>
              <div className="mb-8 border-t border-gray-200 pt-8 text-center">
                <div className="flex items-center justify-center gap-3">
                  <div className="text-2xl text-gray-700">
                    {containsChinese(currentCard.back)
                      ? convertText(currentCard.back)
                      : currentCard.back}
                  </div>
                  {(isChinese(currentCard.back_lang) ||
                    containsChinese(currentCard.back)) && (
                    <SpeakerButton
                      text={currentCard.back}
                      type="word"
                      size="md"
                    />
                  )}
                </div>
                {showPinyin &&
                  (isChinese(currentCard.back_lang) ||
                    containsChinese(currentCard.back)) && (
                    <div className="mt-2 text-lg text-gray-500">
                      {currentCard.pinyin ||
                        getPinyinForText(currentCard.back)}
                    </div>
                  )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={() => handleGrade("forgot")}
                  disabled={grading}
                  className="rounded-lg bg-red-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  Forgot
                </button>
                <button
                  onClick={() => handleGrade("hard")}
                  disabled={grading}
                  className="rounded-lg bg-orange-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  Hard
                </button>
                <button
                  onClick={() => handleGrade("good")}
                  disabled={grading}
                  className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  Good
                </button>
                <button
                  onClick={() => handleGrade("easy")}
                  disabled={grading}
                  className="rounded-lg bg-green-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                >
                  Easy
                </button>
              </div>

              <div className="mt-6 text-center text-xs text-gray-500">
                Rate how well you remembered this card
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
