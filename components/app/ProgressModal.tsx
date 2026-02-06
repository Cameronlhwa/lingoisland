"use client";

import { useEffect, useState } from "react";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import SpeakerButton from "@/components/app/SpeakerButton";

interface CardWithProgress {
  id: string;
  front: string;
  back: string;
  pinyin: string | null;
  front_lang: string | null;
  back_lang: string | null;
  mastery_tier: string;
  interval_days: number;
  ease: number;
  streak: number;
  lapses: number;
  last_reviewed_at: string | null;
  due_at: string | null;
}

interface ProgressModalProps {
  quizIslandId: string;
  initialTier: string | null;
  onClose: () => void;
}

type TierFilter = "all" | "relearning" | "hard" | "good" | "easy" | "new";

const tierConfig = {
  all: { label: "All", colorClass: "bg-gray-900", textColor: "text-gray-900" },
  relearning: { label: "Forgot", colorClass: "bg-red-500", textColor: "text-red-700" },
  hard: { label: "Hard", colorClass: "bg-orange-500", textColor: "text-orange-700" },
  good: { label: "Good", colorClass: "bg-blue-500", textColor: "text-blue-700" },
  easy: { label: "Easy", colorClass: "bg-green-500", textColor: "text-green-700" },
  new: { label: "New", colorClass: "bg-gray-500", textColor: "text-gray-700" },
};

export default function ProgressModal({
  quizIslandId,
  initialTier,
  onClose,
}: ProgressModalProps) {
  const { convertText } = useCharacterSet();
  const [allCards, setAllCards] = useState<CardWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<TierFilter>(
    (initialTier as TierFilter) || "all"
  );
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadAllCards();
  }, [quizIslandId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const loadAllCards = async () => {
    setLoading(true);
    try {
      // Load ALL cards (no tier filter) to get counts for all tiers
      const response = await fetch(
        `/api/quiz-islands/${quizIslandId}/progress`
      );
      if (!response.ok) throw new Error("Failed to load cards");
      const data = await response.json();
      setAllCards(data.cards || []);
    } catch (error) {
      console.error("Error loading cards:", error);
      setAllCards([]);
    } finally {
      setLoading(false);
    }
  };

  const containsChinese = (text: string) => /[\u4e00-\u9fff]/.test(text);

  // Calculate tier counts from all cards
  const tierCounts = allCards.reduce((acc, card) => {
    acc[card.mastery_tier] = (acc[card.mastery_tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Filter cards by selected tier and search query
  const filteredCards = allCards
    .filter((card) => {
      if (selectedTier !== "all" && card.mastery_tier !== selectedTier) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        card.front.toLowerCase().includes(query) ||
        card.back.toLowerCase().includes(query) ||
        (card.pinyin && card.pinyin.toLowerCase().includes(query))
      );
    });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Your Progress</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              title="Close"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2">
            {(["all", "relearning", "hard", "good", "easy", "new"] as TierFilter[]).map(
              (tier) => {
                const config = tierConfig[tier];
                const count =
                  tier === "all"
                    ? allCards.length
                    : tierCounts[tier] || 0;
                const isSelected = selectedTier === tier;

                return (
                  <button
                    key={tier}
                    onClick={() => setSelectedTier(tier)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                      isSelected
                        ? `${config.colorClass} border-transparent text-white`
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {config.label}
                    <span className="ml-1.5 text-xs opacity-75">({count})</span>
                  </button>
                );
              }
            )}
          </div>

          {/* Search Bar */}
          <div className="mt-4">
            <input
              type="text"
              placeholder="Search cards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 placeholder-gray-500 focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>
        </div>

        {/* Card List */}
        <div className="h-[calc(90vh-220px)] overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
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
                <span>Loading cards...</span>
              </div>
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-12 text-center">
              <p className="text-gray-600">
                {searchQuery.trim()
                  ? "No cards match your search"
                  : selectedTier === "all"
                  ? "No cards yet"
                  : selectedTier && tierConfig[selectedTier as TierFilter]
                  ? `No cards in ${tierConfig[selectedTier as TierFilter].label.toLowerCase()} category yet`
                  : "No cards yet"}
              </p>
              {selectedTier !== "all" && !searchQuery.trim() && (
                <p className="mt-2 text-sm text-gray-500">
                  Keep practicing to move cards here!
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCards.map((card) => {
                const config = tierConfig[card.mastery_tier as TierFilter] || tierConfig.new;
                return (
                  <div
                    key={card.id}
                    className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 text-base font-medium text-gray-900">
                          <span>
                            {containsChinese(card.front)
                              ? convertText(card.front)
                              : card.front}
                          </span>
                          {containsChinese(card.front) && (
                            <SpeakerButton text={card.front} type="word" size="sm" />
                          )}
                        </div>
                        <span className="text-gray-400">→</span>
                        <div className="flex items-center gap-2 text-base text-gray-700">
                          <span>
                            {containsChinese(card.back)
                              ? convertText(card.back)
                              : card.back}
                          </span>
                          {containsChinese(card.back) && (
                            <SpeakerButton text={card.back} type="word" size="sm" />
                          )}
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${config.colorClass} text-white`}
                      >
                        {config.label}
                      </span>
                    </div>

                    {card.pinyin && (
                      <div className="mb-2 text-sm text-gray-500">{card.pinyin}</div>
                    )}

                    {/* Stats Row */}
                    {card.last_reviewed_at && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>
                          Streak: <span className="font-medium text-gray-700">{card.streak}</span>
                        </span>
                        <span>
                          Last reviewed:{" "}
                          <span className="font-medium text-gray-700">
                            {formatDate(card.last_reviewed_at)}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
