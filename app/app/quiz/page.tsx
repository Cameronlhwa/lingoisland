"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSearchParams } from "next/navigation";

interface Deck {
  id: string;
  name: string;
  folder_id: string | null;
}

interface ReviewState {
  id: string;
  ease: number;
  intervalDays: number;
  dueAt: string;
  lastReviewedAt: string | null;
}

interface Card {
  id: string;
  front: string;
  back: string;
  pinyin: string | null;
  front_lang: string;
  back_lang: string;
  reviewState: ReviewState | null;
}

type QuizState = "setup" | "reviewing" | "done";

export default function QuizPage() {
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showPinyin, setShowPinyin] = useState(false);
  const [quizState, setQuizState] = useState<QuizState>("setup");
  const [stats, setStats] = useState({ reviewed: 0, total: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDecks();
    // Check for deckId in URL query params
    const deckIdParam = searchParams.get("deckId");
    if (deckIdParam) {
      setSelectedDeckId(deckIdParam);
    }
  }, [searchParams]);

  useEffect(() => {
    // Keyboard shortcuts for ratings
    const handleKeyPress = (e: KeyboardEvent) => {
      if (quizState !== "reviewing" || !showAnswer) return;

      if (e.key === "1") handleAnswer("again");
      else if (e.key === "2") handleAnswer("hard");
      else if (e.key === "3") handleAnswer("good");
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [quizState, showAnswer, currentCardIndex, cards]);

  const loadDecks = async () => {
    try {
      const response = await fetch("/api/decks");
      if (!response.ok) throw new Error("Failed to load decks");

      const data = await response.json();
      setDecks(data.decks || []);
    } catch (error) {
      console.error("Error loading decks:", error);
    }
  };

  const startQuiz = async () => {
    setLoading(true);
    try {
      const url = selectedDeckId
        ? `/api/quiz/daily?deckId=${selectedDeckId}`
        : "/api/quiz/daily";
      const response = await fetch(url);

      if (!response.ok) throw new Error("Failed to load cards");

      const data = await response.json();
      const loadedCards = data.cards || [];

      if (loadedCards.length === 0) {
        alert("No cards available for review. Create some cards first!");
        setLoading(false);
        return;
      }

      setCards(loadedCards);
      setCurrentCardIndex(0);
      setShowAnswer(false);
      setShowPinyin(false);
      setQuizState("reviewing");
      setStats({ reviewed: 0, total: loadedCards.length });
    } catch (error) {
      console.error("Error starting quiz:", error);
      alert("Failed to start quiz. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = async (rating: "again" | "hard" | "good") => {
    const currentCard = cards[currentCardIndex];
    if (!currentCard) return;

    try {
      const response = await fetch("/api/quiz/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardId: currentCard.id,
          rating,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit answer");
      }

      // Move to next card
      const nextIndex = currentCardIndex + 1;
      if (nextIndex >= cards.length) {
        // Quiz complete
        setQuizState("done");
      } else {
        setCurrentCardIndex(nextIndex);
        setShowAnswer(false);
        setShowPinyin(false);
        setStats((prev) => ({ ...prev, reviewed: prev.reviewed + 1 }));
      }
    } catch (error) {
      console.error("Error submitting answer:", error);
      alert("Failed to submit answer. Please try again.");
    }
  };

  const currentCard = cards[currentCardIndex];
  const hasPinyin =
    currentCard?.pinyin &&
    currentCard?.front_lang === "zh" &&
    /[\u4e00-\u9fff]/.test(currentCard.front || ""); // Check if front contains Chinese characters

  if (quizState === "setup") {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-12 text-4xl font-bold tracking-tight text-gray-900">
            {t("Quiz")}
          </h1>

          <div className="mb-8 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <label className="mb-3 block text-sm font-medium text-gray-700">
              {t("Select Deck (optional)")}
            </label>
            <select
              value={selectedDeckId || ""}
              onChange={(e) => setSelectedDeckId(e.target.value || null)}
              className="mb-6 w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              <option value="">{t("All decks")}</option>
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name}
                </option>
              ))}
            </select>

            <button
              onClick={startQuiz}
              disabled={loading}
              className="w-full rounded-lg border border-gray-900 bg-gray-900 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? t("Loading...") : t("Start Quiz")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (quizState === "done") {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <h2 className="mb-4 text-3xl font-bold text-gray-900">
              {t("Done")}
            </h2>
            <p className="mb-8 text-gray-600">
              {t("You reviewed")} {stats.reviewed} {t("of")} {stats.total}{" "}
              {t("cards.")}
            </p>
            <button
              onClick={() => {
                setQuizState("setup");
                setCards([]);
                setCurrentCardIndex(0);
                setStats({ reviewed: 0, total: 0 });
              }}
              className="rounded-lg border border-gray-900 bg-gray-900 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800"
            >
              {t("Review Again")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <p className="text-gray-600">{t("No cards available.")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 text-sm font-medium text-gray-500">
          Card {currentCardIndex + 1} of {cards.length}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          {!showAnswer ? (
            <>
              <div className="mb-8 text-5xl font-bold tracking-tight text-gray-900">
                {currentCard.front}
              </div>
              {hasPinyin && (
                <button
                  onClick={() => setShowPinyin(!showPinyin)}
                  className="mb-4 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
                >
                  {showPinyin ? t("Hide Pinyin") : t("Show Pinyin")}
                </button>
              )}
              {showPinyin && currentCard?.pinyin && (
                <div className="mb-6 text-xl text-gray-500">
                  {currentCard.pinyin}
                </div>
              )}
              <button
                onClick={() => setShowAnswer(true)}
                className="rounded-lg border border-gray-900 bg-gray-900 px-8 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800"
              >
                {t("Show Answer")}
              </button>
            </>
          ) : (
            <>
              <div className="mb-6 text-5xl font-bold tracking-tight text-gray-900">
                {currentCard.front}
              </div>
              {hasPinyin && currentCard.pinyin && (
                <div className="mb-6 text-xl text-gray-500">
                  {currentCard.pinyin}
                </div>
              )}
              <div className="mb-10 border-t border-gray-200 pt-8">
                <div className="text-2xl font-semibold text-gray-700">
                  {currentCard.back}
                </div>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => handleAnswer("again")}
                  className="block w-full rounded-lg border border-red-200 bg-red-50 px-6 py-3 text-base font-medium text-red-700 transition-colors hover:bg-red-100"
                >
                  {t("Again")} (1)
                </button>
                <button
                  onClick={() => handleAnswer("hard")}
                  className="block w-full rounded-lg border border-yellow-200 bg-yellow-50 px-6 py-3 text-base font-medium text-yellow-700 transition-colors hover:bg-yellow-100"
                >
                  {t("Hard")} (2)
                </button>
                <button
                  onClick={() => handleAnswer("good")}
                  className="block w-full rounded-lg border border-green-200 bg-green-50 px-6 py-3 text-base font-medium text-green-700 transition-colors hover:bg-green-100"
                >
                  {t("Good")} (3)
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
