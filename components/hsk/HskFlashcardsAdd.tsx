"use client";

/**
 * HSK Flashcards add-cards — forked from `/app/quiz/[id]/add`.
 */

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { pinyin as pinyinPro } from "pinyin-pro";
import {
  hskFlashcardsDeck,
  hskFlashcardsRoot,
  useHskFlashcardsBasePath,
} from "@/components/hsk/hskFlashcardsPaths";

interface Deck {
  id: string;
  name: string;
  card_count: number;
}

const hasChinese = (value: string) => /[\u4e00-\u9fff]/.test(value);
const generatePinyin = (chinese: string): string => {
  if (!hasChinese(chinese)) return "";
  const result = pinyinPro(chinese, { toneType: "symbol" });
  return Array.isArray(result) ? result.join(" ") : result;
};

export default function HskFlashcardsAdd({ deckId }: { deckId: string }) {
  const router = useRouter();
  const basePath = useHskFlashcardsBasePath();
  const root = hskFlashcardsRoot(basePath);
  const deckPath = hskFlashcardsDeck(basePath, deckId);

  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [chinese, setChinese] = useState("");
  const [english, setEnglish] = useState("");
  const [pinyin, setPinyin] = useState("");
  const [autoPinyin, setAutoPinyin] = useState(true);
  const [createReverse, setCreateReverse] = useState(true);

  const chineseInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDeck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId]);

  useEffect(() => {
    if (autoPinyin && chinese.trim()) {
      setPinyin(generatePinyin(chinese.trim()));
    } else if (!autoPinyin) {
      setPinyin("");
    }
  }, [chinese, autoPinyin]);

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

  const handleSubmit = async () => {
    if (!chinese.trim()) {
      alert("Chinese field is required");
      return;
    }

    if (!english.trim()) {
      if (!confirm("English field is empty. Continue anyway?")) {
        return;
      }
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/hsk/flashcard-decks/${deckId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          front: chinese.trim(),
          back: english.trim(),
          pinyin: pinyin.trim() || null,
          direction: "ZH_EN",
          createReverse,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add card");
      }

      const data = await response.json();
      const cardCount = data.cards?.length || 0;

      if (deck && cardCount > 0) {
        setDeck({
          ...deck,
          card_count: deck.card_count + cardCount,
        });
      }

      alert(`Added ${cardCount} card${cardCount !== 1 ? "s" : ""}`);

      setChinese("");
      setEnglish("");
      setPinyin("");
      chineseInputRef.current?.focus();
    } catch (error) {
      console.error("Error adding card:", error);
      alert(error instanceof Error ? error.message : "Failed to add card");
    } finally {
      setSubmitting(false);
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

  if (!deck) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-600">Deck not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <Link
              href={deckPath}
              className="mb-4 inline-block text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              ← Back to Deck
            </Link>
            <h1 className="mb-2 text-4xl font-bold tracking-tight text-gray-900">
              {deck.name}
            </h1>
            <p className="text-sm text-gray-600">Chinese • Add cards</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
              <h2 className="mb-6 text-xl font-semibold text-gray-900">
                Add cards
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Chinese <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={chineseInputRef}
                    type="text"
                    value={chinese}
                    onChange={(e) => setChinese(e.target.value)}
                    placeholder="你好"
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-base transition-colors focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    English
                  </label>
                  <input
                    type="text"
                    value={english}
                    onChange={(e) => setEnglish(e.target.value)}
                    placeholder="Hello"
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-base transition-colors focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200"
                  />
                  {!english.trim() && (
                    <p className="mt-1 text-xs text-gray-500">
                      English is optional but recommended
                    </p>
                  )}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-900">
                      Pinyin
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={autoPinyin}
                        onChange={(e) => setAutoPinyin(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                      <span>Auto pinyin</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={pinyin}
                    onChange={(e) => setPinyin(e.target.value)}
                    disabled={autoPinyin}
                    placeholder={autoPinyin ? "Auto-generated" : "nǐ hǎo"}
                    className="w-full rounded-lg border border-gray-200 px-4 py-3 text-base transition-colors focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:bg-gray-50 disabled:text-gray-500"
                  />
                </div>

                <div>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={createReverse}
                      onChange={(e) => setCreateReverse(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      Also create reverse card (English → Chinese)
                    </span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => handleSubmit()}
                    disabled={submitting || !chinese.trim()}
                    className="flex-1 rounded-lg border border-gray-900 bg-gray-900 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                  >
                    {submitting ? "Adding..." : "Add card"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                Quick info
              </h3>
              <div className="space-y-4 text-sm text-gray-600">
                <div>
                  <div className="font-medium text-gray-900">
                    Cards in this deck:
                  </div>
                  <div className="mt-1">{deck.card_count}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-900">Reverse cards:</div>
                  <div className="mt-1">{createReverse ? "On" : "Off"}</div>
                </div>
                <div>
                  <div className="font-medium text-gray-900">Auto pinyin:</div>
                  <div className="mt-1">{autoPinyin ? "On" : "Off"}</div>
                </div>
              </div>
              <div className="mt-6 border-t border-gray-200 pt-4">
                <h4 className="mb-2 text-sm font-semibold text-gray-900">Tips</h4>
                <ul className="space-y-2 text-xs text-gray-600">
                  <li>• Chinese field is required</li>
                  <li>• English helps with understanding</li>
                  <li>• Reverse cards create English → Chinese practice</li>
                  <li>• Form clears after each card for quick batch entry</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
