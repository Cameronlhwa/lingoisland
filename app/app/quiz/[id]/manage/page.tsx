"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface QuizIsland {
  id: string;
  name: string;
  card_count: number;
}

interface QuizCard {
  id: string;
  direction: "ZH_EN" | "EN_ZH";
  front: string;
  back: string;
  pinyin: string | null;
  created_at: string;
}

type DirectionFilter = "all" | "ZH_EN" | "EN_ZH";

export default function ManageCardsPage() {
  const router = useRouter();
  const params = useParams();
  const quizIslandId = params.id as string;

  const [quizIsland, setQuizIsland] = useState<QuizIsland | null>(null);
  const [cards, setCards] = useState<QuizCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<QuizCard | null>(null);

  useEffect(() => {
    loadQuizIsland();
  }, [quizIslandId]);

  useEffect(() => {
    loadCards();
  }, [directionFilter, quizIslandId]);

  const loadQuizIsland = async () => {
    try {
      const response = await fetch(`/api/quiz-islands/${quizIslandId}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push("/app/quiz");
          return;
        }
        throw new Error("Failed to load quiz island");
      }
      const data = await response.json();
      setQuizIsland(data.quizIsland);
    } catch (error) {
      console.error("Error loading quiz island:", error);
    }
  };

  const loadCards = async () => {
    setLoading(true);
    try {
      const url =
        directionFilter === "all"
          ? `/api/quiz-islands/${quizIslandId}/cards`
          : `/api/quiz-islands/${quizIslandId}/cards?direction=${directionFilter}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to load cards");
      const data = await response.json();
      setCards(data.cards || []);
    } catch (error) {
      console.error("Error loading cards:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (card: QuizCard) => {
    setCardToDelete(card);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!cardToDelete) return;

    setDeletingCardId(cardToDelete.id);
    try {
      const response = await fetch(
        `/api/quiz-islands/${quizIslandId}/cards/${cardToDelete.id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete card");
      }

      // Remove card from state and update card count
      setCards((prev) => prev.filter((c) => c.id !== cardToDelete.id));
      setQuizIsland((prev) =>
        prev ? { ...prev, card_count: Math.max(0, prev.card_count - 1) } : null
      );
      setShowDeleteModal(false);
      setCardToDelete(null);
    } catch (error) {
      console.error("Error deleting card:", error);
      alert(error instanceof Error ? error.message : "Failed to delete card");
    } finally {
      setDeletingCardId(null);
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
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!quizIsland) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-600">Quiz island not found</div>
      </div>
    );
  }

  const filteredCards = cards;
  const directionLabel = {
    ZH_EN: "Chinese → English",
    EN_ZH: "English → Chinese",
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <Link
              href={`/app/quiz/${quizIslandId}`}
              className="mb-4 inline-block text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              ← Back to Quiz Island
            </Link>
            <h1 className="mb-2 text-4xl font-bold tracking-tight text-gray-900">
              {quizIsland.name}
            </h1>
            <p className="text-sm text-gray-600">
              Manage cards • {quizIsland.card_count} total
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setDirectionFilter("all")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              directionFilter === "all"
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setDirectionFilter("ZH_EN")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              directionFilter === "ZH_EN"
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            Chinese → English
          </button>
          <button
            onClick={() => setDirectionFilter("EN_ZH")}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              directionFilter === "EN_ZH"
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            English → Chinese
          </button>
        </div>

        {/* Cards List */}
        {filteredCards.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <p className="text-gray-600">
              {directionFilter === "all"
                ? "No cards in this quiz island yet."
                : `No ${directionLabel[directionFilter as "ZH_EN" | "EN_ZH"]} cards.`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCards.map((card) => (
              <div
                key={card.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
              >
                <div className="flex-1">
                  <div className="mb-1 text-sm font-semibold text-gray-900">
                    {directionLabel[card.direction]}
                  </div>
                  <div className="text-base text-gray-900">
                    <span className="font-medium">{card.front}</span>
                    <span className="mx-2 text-gray-400">→</span>
                    <span>{card.back}</span>
                  </div>
                  {card.pinyin && (
                    <div className="mt-1 text-sm text-gray-500">{card.pinyin}</div>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteClick(card)}
                  disabled={deletingCardId === card.id}
                  className="ml-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
                  title="Delete card"
                >
                  {deletingCardId === card.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && cardToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">
                Delete this card?
              </h3>
              <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="mb-2 text-sm font-semibold text-gray-900">
                  {directionLabel[cardToDelete.direction]}
                </div>
                <div className="text-base text-gray-900">
                  <span className="font-medium">{cardToDelete.front}</span>
                  <span className="mx-2 text-gray-400">→</span>
                  <span>{cardToDelete.back}</span>
                </div>
                {cardToDelete.pinyin && (
                  <div className="mt-2 text-sm text-gray-500">
                    {cardToDelete.pinyin}
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setCardToDelete(null);
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deletingCardId !== null}
                  className="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingCardId !== null ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

