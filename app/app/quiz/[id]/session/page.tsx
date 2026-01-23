"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { pinyin as pinyinPro } from "pinyin-pro";

interface Card {
  id: string;
  front: string;
  back: string;
  pinyin: string | null;
  front_lang: string | null;
  back_lang: string | null;
  queue_bucket?: "due" | "review" | "new";
}

export default function QuizSessionPage() {
  const router = useRouter();
  const params = useParams();
  const quizIslandId = params.id as string;
  const maxSessionCards = 10;

  const [cards, setCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showPinyin, setShowPinyin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    loadQueue();
  }, [quizIslandId]);

  const shuffleArray = <T,>(items: T[]) => {
    const array = [...items];
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const interleaveQueues = <T,>(primary: T[], secondary: T[]) => {
    const result: T[] = [];
    let i = 0;
    let j = 0;
    while (i < primary.length || j < secondary.length) {
      if (i < primary.length) result.push(primary[i++]);
      if (j < secondary.length) result.push(secondary[j++]);
    }
    return result;
  };

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

  const buildStrategicQueue = (queue: Card[]) => {
    const due = queue.filter((card) => card.queue_bucket === "due");
    const newCards = queue.filter((card) => card.queue_bucket === "new");
    const review = queue.filter(
      (card) =>
        card.queue_bucket === "review" || card.queue_bucket === undefined
    );

    const mixed = interleaveQueues(shuffleArray(due), shuffleArray(newCards));
    return [...mixed, ...shuffleArray(review)].slice(0, maxSessionCards);
  };

  const loadQueue = async () => {
    try {
      const response = await fetch(`/api/quiz-islands/${quizIslandId}/queue`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push("/app/quiz");
          return;
        }
        throw new Error("Failed to load queue");
      }
      const data = await response.json();
      setCards(buildStrategicQueue(data.cards || []));
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
      const response = await fetch(
        `/api/quiz-islands/${quizIslandId}/grade`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardId: currentCard.id, rating }),
        }
      );

      if (!response.ok) throw new Error("Failed to grade");

      // Move to next card
      if (currentIndex < cards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setShowAnswer(false);
      } else {
        // Quiz complete
        router.push(`/app/quiz/${quizIslandId}`);
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
          <span>Loading quiz...</span>
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="mb-6 text-gray-600">
            No cards to review right now!
          </p>
          <button
            onClick={() => router.push(`/app/quiz/${quizIslandId}`)}
            className="inline-block rounded-lg border border-gray-900 bg-gray-900 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800"
          >
            Back to Quiz Island
          </button>
        </div>
      </div>
    );
  }

  const currentCard = cards[currentIndex];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl">
        {/* Progress */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push(`/app/quiz/${quizIslandId}`)}
            className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            ← Exit Quiz
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

        {/* Card */}
        <div className="rounded-xl border border-gray-200 bg-white p-12 shadow-sm">
          <div className="mb-8 text-center">
            <div className="mb-4 text-4xl font-bold text-gray-900">
              {currentCard.front}
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
                <div className="text-2xl text-gray-700">{currentCard.back}</div>
                {showPinyin &&
                  (isChinese(currentCard.back_lang) ||
                    containsChinese(currentCard.back)) && (
                    <div className="mt-2 text-lg text-gray-500">
                      {currentCard.pinyin || getPinyinForText(currentCard.back)}
                    </div>
                  )}
              </div>

              {/* Grade Buttons */}
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

              {/* Hint text */}
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

