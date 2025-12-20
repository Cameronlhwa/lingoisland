"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

interface Card {
  id: string;
  front: string;
  back: string;
  pinyin: string | null;
  front_lang: string;
  back_lang: string;
  created_at: string;
}

interface Deck {
  id: string;
  name: string;
  folder_id: string | null;
}

export default function DeckDetailPage() {
  const router = useRouter();
  const params = useParams();
  const deckId = params.deckId as string;
  const { t } = useLanguage();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [pinyin, setPinyin] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadDeck();
    loadCards();
  }, [deckId]);

  const loadDeck = async () => {
    try {
      const response = await fetch("/api/decks");
      if (!response.ok) throw new Error("Failed to load deck");

      const data = await response.json();
      const foundDeck = data.decks.find((d: Deck) => d.id === deckId);
      if (foundDeck) {
        setDeck(foundDeck);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Error loading deck:", error);
      setLoading(false);
    }
  };

  const loadCards = async () => {
    try {
      const response = await fetch(`/api/decks/${deckId}/cards`);
      if (!response.ok) throw new Error("Failed to load cards");

      const data = await response.json();
      setCards(data.cards || []);
      setLoading(false);
    } catch (error) {
      console.error("Error loading cards:", error);
      setLoading(false);
    }
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;

    setCreating(true);
    try {
      const response = await fetch(`/api/decks/${deckId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          front: front.trim(),
          back: back.trim(),
          pinyin: pinyin.trim() || null,
          frontLang: "zh",
          backLang: "en",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create card");
      }

      const data = await response.json();
      setCards([data.card, ...cards]);
      setFront("");
      setBack("");
      setPinyin("");
    } catch (error) {
      console.error("Error creating card:", error);
      alert(error instanceof Error ? error.message : "Failed to create card");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">Deck not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10">
          <button
            onClick={() => router.push("/app/decks")}
            className="mb-4 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            ← {t("Back to Decks")}
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              {deck.name}
            </h1>
            <button
              onClick={() => router.push(`/app/quiz?deckId=${deckId}`)}
              className="rounded-lg border border-gray-900 bg-gray-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
            >
              {t("Start Quiz")}
            </button>
          </div>
        </div>

        {/* Add Card Form */}
        <div className="mb-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-gray-900">{t("Add Card")}</h2>
          <form onSubmit={handleCreateCard} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {t("Front (Hanzi)")}
              </label>
              <input
                type="text"
                value={front}
                onChange={(e) => setFront(e.target.value)}
                placeholder="汉字"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {t("Back (English)")}
              </label>
              <input
                type="text"
                value={back}
                onChange={(e) => setBack(e.target.value)}
                placeholder="English meaning"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {t("Pinyin (optional)")}
              </label>
              <input
                type="text"
                value={pinyin}
                onChange={(e) => setPinyin(e.target.value)}
                placeholder="pīnyīn"
                className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>
            <button
              type="submit"
              disabled={creating || !front.trim() || !back.trim()}
              className="rounded-lg border border-gray-900 bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {creating ? t("Creating...") : t("Create Card")}
            </button>
          </form>
        </div>

        {/* Cards List */}
        <div>
          <h2 className="mb-6 text-lg font-semibold text-gray-900">
            {t("Cards")} ({cards.length})
          </h2>
          {cards.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
                >
                  <div className="mb-3 text-2xl font-bold text-gray-900">
                    {card.front}
                  </div>
                  {card.pinyin && (
                    <div className="mb-3 text-sm text-gray-500">
                      {card.pinyin}
                    </div>
                  )}
                  <div className="text-base text-gray-600">{card.back}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
              <p className="text-gray-500">
                {t("No cards yet. Add your first card above.")}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
