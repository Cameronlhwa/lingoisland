"use client";

/**
 * HSK Flashcards deck detail — forked from `/app/quiz/[id]`.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import { QuizMasteryStats } from "@/components/app/QuizMasteryStats";
import ProgressModal from "@/components/app/ProgressModal";
import {
  hskFlashcardsDeck,
  hskFlashcardsRoot,
  useHskFlashcardsBasePath,
  useIsHskAppPreview,
} from "@/components/hsk/hskFlashcardsPaths";
import { HSK_APP_LABELS } from "@/lib/hsk-app-labels";

interface Deck {
  id: string;
  name: string;
  created_at: string;
  card_count: number;
}

export default function HskFlashcardsDeckDetail({
  deckId,
}: {
  deckId: string;
}) {
  const router = useRouter();
  const basePath = useHskFlashcardsBasePath();
  const isHskApp = useIsHskAppPreview();
  const root = hskFlashcardsRoot(basePath);
  const deckPath = hskFlashcardsDeck(basePath, deckId);
  const { convertText } = useCharacterSet();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

  useEffect(() => {
    loadDeck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  const loadDeck = async () => {
    try {
      const response = await fetch(`/api/hsk/flashcard-decks/${deckId}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push(root);
          return;
        }
        throw new Error("Failed to load deck");
      }
      const data = await response.json();
      setDeck(data.deck);
    } catch (error) {
      console.error("Error loading deck:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEditName = () => {
    if (deck) {
      setEditedName(deck.name);
      setIsEditingName(true);
    }
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditedName("");
  };

  const handleSaveName = async () => {
    if (!editedName.trim() || !deck || editedName === deck.name) {
      handleCancelEditName();
      return;
    }

    setSavingName(true);
    try {
      const response = await fetch(`/api/hsk/flashcard-decks/${deckId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editedName.trim() }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to update name");
      }

      setDeck({ ...deck, name: editedName.trim() });
      setIsEditingName(false);
      setEditedName("");
    } catch (error) {
      console.error("Error updating name:", error);
      alert(error instanceof Error ? error.message : "Failed to update name");
    } finally {
      setSavingName(false);
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
          <span>Loading deck...</span>
        </div>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-600">Deck not found</div>
      </div>
    );
  }

  const hasCards = deck.card_count > 0;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <button
            onClick={() => router.push(root)}
            className="mb-4 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            ← Back to {isHskApp ? HSK_APP_LABELS.flashcards.nav : "Flashcards"}
          </button>
          {isEditingName ? (
            <div className="mb-2 flex items-center gap-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveName();
                  } else if (e.key === "Escape") {
                    handleCancelEditName();
                  }
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-3xl font-bold text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
                autoFocus
                disabled={savingName}
              />
              <button
                onClick={handleSaveName}
                disabled={savingName || !editedName.trim()}
                className="rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                {savingName ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleCancelEditName}
                disabled={savingName}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="group mb-2 flex items-center gap-3">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                {convertText(deck.name)}
              </h1>
              <button
                onClick={handleStartEditName}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 opacity-0 transition-all hover:border-gray-300 hover:text-gray-900 group-hover:opacity-100"
                title="Edit name"
              >
                Edit
              </button>
            </div>
          )}
          <p className="text-sm text-gray-600">
            Chinese • {deck.card_count} card
            {deck.card_count !== 1 ? "s" : ""}
          </p>
        </div>

        {!hasCards ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <p className="mb-6 text-gray-600">
              This deck is empty. Add cards to start practicing.
            </p>
            <Link
              href={`${deckPath}/add`}
              className="inline-block rounded-lg border border-gray-900 bg-gray-900 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800"
            >
              Add Cards
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
              <h2 className="mb-6 text-xl font-semibold text-gray-900">
                Ready to practice?
              </h2>
              <button
                onClick={() => router.push(`${deckPath}/session`)}
                className="mb-2 w-full rounded-lg border border-gray-900 bg-gray-900 px-6 py-4 text-center text-base font-medium text-white transition-colors hover:bg-gray-800"
              >
                Start Flashcards
              </button>
              <p className="mb-4 text-sm text-gray-500">
                Reviews here count toward your Progress Island on Home — every
                10 cards levels up the island.
              </p>
              <div className="mt-4 flex gap-3">
                <Link
                  href={`${deckPath}/add`}
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Add Cards
                </Link>
                <Link
                  href={`${deckPath}/manage`}
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Manage
                </Link>
              </div>
            </div>

            <QuizMasteryStats
              quizIslandId={deckId}
              onTierClick={(tier) => {
                const tierMap: Record<string, string> = {
                  forgot: "relearning",
                  hard: "hard",
                  good: "good",
                  easy: "easy",
                };
                setSelectedTier(tierMap[tier] || tier);
                setShowProgressModal(true);
              }}
            />
          </div>
        )}

        {showProgressModal && (
          <ProgressModal
            quizIslandId={deckId}
            initialTier={selectedTier}
            onClose={() => setShowProgressModal(false)}
          />
        )}
      </div>
    </div>
  );
}
