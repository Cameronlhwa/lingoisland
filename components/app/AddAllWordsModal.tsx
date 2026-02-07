"use client";

import { useState, useEffect } from "react";
import { useCharacterSet } from "@/contexts/CharacterSetContext";

interface Word {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string;
  position?: number;
  is_locked?: boolean;
}

interface QuizIsland {
  id: string;
  name: string;
}

interface AddAllWordsModalProps {
  open: boolean;
  onClose: () => void;
  words: Word[];
  islandId: string;
}

export default function AddAllWordsModal({
  open,
  onClose,
  words,
  islandId,
}: AddAllWordsModalProps) {
  const { convertText } = useCharacterSet();
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [quizIslands, setQuizIslands] = useState<QuizIsland[]>([]);
  const [selectedQuizIslandId, setSelectedQuizIslandId] = useState<string>("");
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newQuizIslandName, setNewQuizIslandName] = useState("");
  const [loading, setLoading] = useState(false);
  const [creatingQuizIsland, setCreatingQuizIsland] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When modal opens, load quiz islands once
  useEffect(() => {
    if (open) loadQuizIslands();
  }, [open]);

  // When modal opens or words change, sync selected words from current words
  useEffect(() => {
    if (!open) return;
    const unlockedWordIds = words
      .filter((word) => !word.is_locked)
      .map((word) => word.id);
    setSelectedWords(new Set(unlockedWordIds));
  }, [open, words]);

  const loadQuizIslands = async () => {
    try {
      const response = await fetch("/api/quiz-islands");
      if (!response.ok) throw new Error("Failed to load quiz islands");
      const data = await response.json();
      setQuizIslands(data.quizIslands || []);

      // Set last used or first quiz island as default
      const lastUsed = localStorage.getItem("lastUsedQuizIslandId");
      if (
        lastUsed &&
        data.quizIslands?.some((qi: QuizIsland) => qi.id === lastUsed)
      ) {
        setSelectedQuizIslandId(lastUsed);
      } else if (data.quizIslands && data.quizIslands.length > 0) {
        setSelectedQuizIslandId(data.quizIslands[0].id);
      }
    } catch (error) {
      console.error("Error loading quiz islands:", error);
      setError("Failed to load quiz islands");
    }
  };

  const toggleWord = (wordId: string) => {
    setSelectedWords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(wordId)) {
        newSet.delete(wordId);
      } else {
        newSet.add(wordId);
      }
      return newSet;
    });
  };

  const toggleAll = () => {
    if (selectedWords.size === words.filter((w) => !w.is_locked).length) {
      // Deselect all
      setSelectedWords(new Set());
    } else {
      // Select all unlocked
      const unlockedWordIds = words
        .filter((word) => !word.is_locked)
        .map((word) => word.id);
      setSelectedWords(new Set(unlockedWordIds));
    }
  };

  const handleCreateNewQuizIsland = async () => {
    if (!newQuizIslandName.trim()) return;

    setCreatingQuizIsland(true);
    try {
      const response = await fetch("/api/quiz-islands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newQuizIslandName.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create quiz island");
      }

      const data = await response.json();
      const newQuizIsland = data.quizIsland;

      // Add to list and select it
      setQuizIslands((prev) => [newQuizIsland, ...prev]);
      setSelectedQuizIslandId(newQuizIsland.id);
      setShowCreateNew(false);
      setNewQuizIslandName("");

      // Save to localStorage
      localStorage.setItem("lastUsedQuizIslandId", newQuizIsland.id);

      // Now proceed to add the items
      await handleAddToQuiz(newQuizIsland.id);
    } catch (error) {
      console.error("Error creating quiz island:", error);
      setError(
        error instanceof Error ? error.message : "Failed to create quiz island"
      );
    } finally {
      setCreatingQuizIsland(false);
    }
  };

  const handleAddToQuiz = async (quizIslandIdOverride?: string) => {
    const quizIslandId = quizIslandIdOverride || selectedQuizIslandId;
    if (!quizIslandId) {
      setError("Please select a quiz island");
      return;
    }

    if (selectedWords.size === 0) {
      setError("Please select at least one word");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const selectedWordsArray = Array.from(selectedWords);
      let addedCount = 0;
      let failedCount = 0;

      // Add words one by one
      for (const wordId of selectedWordsArray) {
        try {
          const response = await fetch("/api/quiz-islands/add-from-topic-item", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              quizIslandId,
              type: "word",
              sourceId: wordId,
              createReverse: true, // Words create reverse by default
            }),
          });

          if (response.ok) {
            addedCount++;
          } else {
            failedCount++;
            const errorData = await response.json();
            console.error(`Failed to add word ${wordId}:`, errorData);
          }
        } catch (error) {
          failedCount++;
          console.error(`Error adding word ${wordId}:`, error);
        }
      }

      // Save last used quiz island to localStorage
      localStorage.setItem("lastUsedQuizIslandId", quizIslandId);

      if (addedCount > 0) {
        // Success - close modal
        onClose();
        // Optionally show a success message
        if (failedCount > 0) {
          alert(
            `Added ${addedCount} words to quiz. ${failedCount} words failed to add.`
          );
        }
      } else {
        setError("Failed to add words to quiz");
      }
    } catch (error) {
      console.error("Error adding to quiz:", error);
      setError(
        error instanceof Error ? error.message : "Failed to add to quiz"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const unlockedWords = words.filter((w) => !w.is_locked);
  const lockedWords = words.filter((w) => w.is_locked);
  const allUnlockedSelected =
    selectedWords.size === unlockedWords.length && unlockedWords.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] rounded-xl border border-gray-200 bg-white shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <h3 className="text-xl font-semibold text-gray-900">
            Add Words to Quiz
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Select the words you want to add to your quiz. Each word will create
            2 cards (Chinese → English and English → Chinese).
          </p>
          {error && (
            <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Words List */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Select All Toggle */}
          <div className="mb-4 flex items-center justify-between border-b border-gray-200 pb-3">
            <label className="flex items-center gap-3 text-sm font-medium text-gray-900 cursor-pointer">
              <input
                type="checkbox"
                checked={allUnlockedSelected}
                onChange={toggleAll}
                className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-200"
              />
              Select all unlocked words ({unlockedWords.length})
            </label>
            <span className="text-sm text-gray-600">
              {selectedWords.size} selected
            </span>
          </div>

          {/* Unlocked Words */}
          <div className="space-y-2">
            {unlockedWords.map((word) => (
              <label
                key={word.id}
                className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedWords.has(word.id)}
                  onChange={() => toggleWord(word.id)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-200"
                />
                <div className="flex-1">
                  <div className="text-base font-semibold text-gray-900">
                    {convertText(word.hanzi)}
                  </div>
                  <div className="text-sm text-gray-700">{word.pinyin}</div>
                  <div className="text-sm text-gray-600">{word.english}</div>
                </div>
              </label>
            ))}
          </div>

          {/* Locked Words */}
          {lockedWords.length > 0 && (
            <div className="mt-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-500">
                <span>🔒</span>
                <span>Locked Words (Upgrade to unlock)</span>
              </div>
              <div className="space-y-2">
                {lockedWords.map((word) => (
                  <div
                    key={word.id}
                    className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 opacity-60"
                  >
                    <input
                      type="checkbox"
                      disabled
                      className="mt-1 h-4 w-4 rounded border-gray-300 cursor-not-allowed"
                    />
                    <div className="flex-1">
                      <div className="text-base font-semibold text-gray-600">
                        {convertText(word.hanzi)}
                      </div>
                      <div className="text-sm text-gray-500">{word.pinyin}</div>
                      <div className="text-sm text-gray-500">{word.english}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 space-y-4">
          {showCreateNew ? (
            /* Create New Quiz Island */
            <div className="space-y-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Quiz Island Name
                </label>
                <input
                  type="text"
                  value={newQuizIslandName}
                  onChange={(e) => setNewQuizIslandName(e.target.value)}
                  placeholder="e.g., Basic Vocabulary"
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                  autoFocus
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCreateNew(false);
                    setNewQuizIslandName("");
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateNewQuizIsland}
                  disabled={creatingQuizIsland || !newQuizIslandName.trim()}
                  className="rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                >
                  {creatingQuizIsland ? "Creating..." : "Create & Add"}
                </button>
              </div>
            </div>
          ) : (
            /* Select Existing Quiz Island */
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Add to Quiz Island
                </label>
                <select
                  value={selectedQuizIslandId}
                  onChange={(e) => setSelectedQuizIslandId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                >
                  {quizIslands.length === 0 ? (
                    <option value="">No quiz islands yet</option>
                  ) : (
                    quizIslands.map((island) => (
                      <option key={island.id} value={island.id}>
                        {island.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
              {quizIslands.length > 0 && (
                <button
                  onClick={() => setShowCreateNew(true)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  + Create new quiz island
                </button>
              )}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={onClose}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleAddToQuiz()}
                  disabled={
                    loading ||
                    !selectedQuizIslandId ||
                    selectedWords.size === 0
                  }
                  className="rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                >
                  {loading
                    ? "Adding..."
                    : `Add ${selectedWords.size} word${selectedWords.size !== 1 ? "s" : ""}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
