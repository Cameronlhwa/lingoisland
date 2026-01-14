"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useRouter, useParams } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";

interface Sentence {
  id: string;
  tier: "easy" | "same" | "hard";
  hanzi: string;
  pinyin: string;
  english: string;
  grammar_tag?: string | null;
}

interface Word {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string;
  sentences: Sentence[];
}

interface Island {
  id: string;
  topic: string;
  level: string;
  word_target: number;
  grammar_target: number;
  status: string;
}

export default function TopicIslandDetailPage() {
  const router = useRouter();
  const params = useParams();
  const islandId = params.id as string;
  const supabase = createClient();
  const { t } = useLanguage();

  const [island, setIsland] = useState<Island | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingKnown, setMarkingKnown] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [quizIslands, setQuizIslands] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [showAddToQuizModal, setShowAddToQuizModal] = useState(false);
  const [selectedQuizIslandId, setSelectedQuizIslandId] = useState<string>("");
  const [addingToQuiz, setAddingToQuiz] = useState(false);
  const [addToQuizContext, setAddToQuizContext] = useState<{
    type: "word" | "sentence";
    sourceId: string;
  } | null>(null);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newQuizIslandName, setNewQuizIslandName] = useState("");
  const [creatingQuizIsland, setCreatingQuizIsland] = useState(false);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set()); // Track added items

  useEffect(() => {
    loadIsland();
    loadQuizIslands();
    // Load last used quiz island from localStorage
    const lastUsed = localStorage.getItem("lastUsedQuizIslandId");
    if (lastUsed) {
      setSelectedQuizIslandId(lastUsed);
    }
    // Poll for updates if status is generating
    const interval = setInterval(() => {
      if (island?.status === "generating") {
        loadIsland();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [islandId, island?.status]);

  const loadQuizIslands = async () => {
    try {
      const response = await fetch("/api/quiz-islands");
      if (!response.ok) throw new Error("Failed to load quiz islands");
      const data = await response.json();
      setQuizIslands(data.quizIslands || []);

      // If we have a last used ID, check if it still exists
      const lastUsed = localStorage.getItem("lastUsedQuizIslandId");
      if (
        lastUsed &&
        data.quizIslands?.some((qi: { id: string }) => qi.id === lastUsed)
      ) {
        setSelectedQuizIslandId(lastUsed);
      } else if (data.quizIslands && data.quizIslands.length > 0) {
        // Default to first quiz island if no last used or it doesn't exist
        setSelectedQuizIslandId(data.quizIslands[0].id);
      }
    } catch (error) {
      console.error("Error loading quiz islands:", error);
    }
  };

  const loadIsland = async () => {
    try {
      const response = await fetch(`/api/topic-islands/${islandId}`);
      if (!response.ok) {
        throw new Error("Failed to load island");
      }

      const data = await response.json();
      setIsland(data.island);
      setWords(data.words);
      setLoading(false);
    } catch (error) {
      console.error("Error loading island:", error);
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this topic island? This will delete all words and sentences."
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/topic-islands/${islandId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete island");
      }

      // Redirect to islands list
      router.push("/app/topic-islands");
    } catch (error) {
      console.error("Error deleting island:", error);
      alert("Failed to delete island. Please try again.");
      setDeleting(false);
    }
  };

  const handleMarkKnown = async (wordId: string) => {
    setMarkingKnown(wordId);
    try {
      const response = await fetch(`/api/island-words/${wordId}/mark-known`, {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || errorData.error || "Failed to mark word as known"
        );
      }

      const data = await response.json();

      // Replace only the specific word card
      if (data.newWord) {
        setWords((prevWords) => {
          // Find and replace the word with the same ID, or remove deleted and add new
          const filtered = prevWords.filter((w) => w.id !== data.deletedWordId);
          // Add new word in the same position if possible, otherwise at the end
          const deletedIndex = prevWords.findIndex(
            (w) => w.id === data.deletedWordId
          );
          if (deletedIndex >= 0) {
            return [
              ...filtered.slice(0, deletedIndex),
              data.newWord,
              ...filtered.slice(deletedIndex),
            ];
          }
          return [...filtered, data.newWord];
        });
      }
    } catch (error) {
      console.error("Error marking word as known:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update word. Please try again.";
      alert(errorMessage);
    } finally {
      setMarkingKnown(null);
    }
  };

  const handleAddToQuizClick = (
    type: "word" | "sentence",
    sourceId: string
  ) => {
    // Check if already added
    if (addedItems.has(`${type}-${sourceId}`)) {
      return; // Already added, don't show modal
    }

    if (quizIslands.length === 0) {
      // Show create modal if no quiz islands exist
      setShowCreateNew(true);
      setAddToQuizContext({ type, sourceId });
      setShowAddToQuizModal(true);
      return;
    }

    setAddToQuizContext({ type, sourceId });
    setShowAddToQuizModal(true);
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

      // Now proceed to add the item
      await handleAddToQuizConfirm(newQuizIsland.id);
    } catch (error) {
      console.error("Error creating quiz island:", error);
      alert(
        error instanceof Error ? error.message : "Failed to create quiz island"
      );
    } finally {
      setCreatingQuizIsland(false);
    }
  };

  const handleAddToQuizConfirm = async (quizIslandIdOverride?: string) => {
    const quizIslandId = quizIslandIdOverride || selectedQuizIslandId;
    if (!quizIslandId || !addToQuizContext) return;

    setAddingToQuiz(true);
    try {
      const response = await fetch("/api/quiz-islands/add-from-topic-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quizIslandId,
          type: addToQuizContext.type,
          sourceId: addToQuizContext.sourceId,
          createReverse: addToQuizContext.type === "word", // Words create reverse by default
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add to quiz");
      }

      const data = await response.json();

      // Mark as added
      const itemKey = `${addToQuizContext.type}-${addToQuizContext.sourceId}`;
      setAddedItems((prev) => {
        const newSet = new Set(prev);
        newSet.add(itemKey);
        return newSet;
      });

      // Save last used quiz island to localStorage
      localStorage.setItem("lastUsedQuizIslandId", quizIslandId);

      // Show success (non-blocking, subtle)
      // The button state will update automatically via addedItems

      setShowAddToQuizModal(false);
      setSelectedQuizIslandId(quizIslandId);
      setAddToQuizContext(null);
      setShowCreateNew(false);
    } catch (error) {
      console.error("Error adding to quiz:", error);
      alert(error instanceof Error ? error.message : "Failed to add to quiz");
    } finally {
      setAddingToQuiz(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
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
          <span>Loading topic island...</span>
        </div>
      </div>
    );
  }

  if (!island) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">Island not found</div>
      </div>
    );
  }

  const progressPercentage =
    island.status === "ready" ? 100 : (words.length / island.word_target) * 100;

  // Group sentences by grammar pattern (if any)
  const grammarMap = new Map<
    string,
    { easy?: Sentence; same?: Sentence; hard?: Sentence }
  >();
  for (const word of words) {
    for (const sentence of word.sentences) {
      if (!sentence.grammar_tag) continue;
      if (!grammarMap.has(sentence.grammar_tag)) {
        grammarMap.set(sentence.grammar_tag, {});
      }
      const group = grammarMap.get(sentence.grammar_tag)!;
      if (sentence.tier === "easy" && !group.easy) group.easy = sentence;
      if (sentence.tier === "same" && !group.same) group.same = sentence;
      if (sentence.tier === "hard" && !group.hard) group.hard = sentence;
    }
  }

  const grammarEntries = Array.from(grammarMap.entries());

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-10">
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={() => router.push("/app/topic-islands")}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
            >
              ← Back to Topic Islands
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-sm font-medium text-red-600 transition-colors hover:text-red-800 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete Island"}
            </button>
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900">
            {island.topic}
          </h1>
          <div className="mb-6 space-y-1 text-sm text-gray-600">
            <p>Level: {island.level}</p>
            <p className="capitalize">Status: {island.status}</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-2">
            <div className="mb-2 flex justify-between text-sm font-medium text-gray-600">
              <span>Progress</span>
              <span>
                {words.length} / {island.word_target} words
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-gray-900 transition-all"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Grammar Focus */}
        {grammarEntries.length > 0 && (
          <div className="mb-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Grammar Focus
            </h2>
            <div className="space-y-6">
              {grammarEntries.map(([tag, tiers]) => (
                <div
                  key={tag}
                  className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0"
                >
                  <h3 className="mb-2 text-base font-semibold text-gray-900">
                    {tag}
                  </h3>
                  <div className="space-y-3 text-sm text-gray-700">
                    {tiers.easy && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Easy
                        </div>
                        <div className="mt-1 text-base text-gray-900">
                          {tiers.easy.hanzi}
                        </div>
                        <div className="text-sm text-gray-700">
                          {tiers.easy.pinyin}
                        </div>
                        <div className="text-sm text-gray-600">
                          {tiers.easy.english}
                        </div>
                      </div>
                    )}
                    {tiers.same && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Your level
                        </div>
                        <div className="mt-1 text-base text-gray-900">
                          {tiers.same.hanzi}
                        </div>
                        <div className="text-sm text-gray-700">
                          {tiers.same.pinyin}
                        </div>
                        <div className="text-sm text-gray-600">
                          {tiers.same.english}
                        </div>
                      </div>
                    )}
                    {tiers.hard && (
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Slightly harder
                        </div>
                        <div className="mt-1 text-base text-gray-900">
                          {tiers.hard.hanzi}
                        </div>
                        <div className="text-sm text-gray-700">
                          {tiers.hard.pinyin}
                        </div>
                        <div className="text-sm text-gray-600">
                          {tiers.hard.english}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Generating Message */}
        {island.status === "generating" && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-3">
              <p className="text-base font-medium text-gray-900">
                Generating {island.word_target} words
                {island.grammar_target > 0 &&
                  ` and ${island.grammar_target} grammar pattern${
                    island.grammar_target > 1 ? "s" : ""
                  }`}{" "}
                for "{island.topic}" at {island.level}...
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {words.length} of {island.word_target} words completed
              </p>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full bg-gray-900 transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Message */}
        {island.status === "error" && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
            <div className="mb-4">
              <p className="mb-2 text-base font-medium text-red-900">
                Error generating words
              </p>
              <p className="text-sm text-red-700">
                There was an issue generating words for this topic island. You
                can try again or create a new island.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={async () => {
                  try {
                    // Reset status to draft and retry generation
                    const response = await fetch(
                      `/api/topic-islands/${islandId}/generate-batch`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ batchSize: 5 }),
                      }
                    );

                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({}));
                      throw new Error(
                        errorData.message ||
                          errorData.error ||
                          "Failed to retry generation"
                      );
                    }

                    // Reload island to show updated status
                    await loadIsland();
                  } catch (error) {
                    console.error("Error retrying generation:", error);
                    alert(
                      error instanceof Error
                        ? error.message
                        : "Failed to retry generation. Please try again."
                    );
                  }
                }}
                className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
              >
                Retry Generation
              </button>
              <button
                onClick={() => router.push("/app/topic-islands")}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Create New Island
              </button>
            </div>
          </div>
        )}

        {/* Words List / Loading State */}
        {words.length > 0 ? (
          <div className="space-y-6">
            {words.map((word) => (
              <div
                key={word.id}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <div className="mb-2 text-3xl font-bold text-gray-900">
                      {word.hanzi}
                    </div>
                    <div className="mb-2 text-lg text-gray-700">
                      {word.pinyin}
                    </div>
                    <div className="text-base text-gray-600">
                      {word.english}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleAddToQuizClick("word", word.id)}
                      disabled={addedItems.has(`word-${word.id}`)}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow-md disabled:bg-gray-50 disabled:text-gray-500"
                    >
                      {addedItems.has(`word-${word.id}`)
                        ? "✓ In quiz"
                        : t("Add to quiz")}
                    </button>
                    <button
                      onClick={() => handleMarkKnown(word.id)}
                      disabled={markingKnown === word.id}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow-md disabled:opacity-50"
                    >
                      {markingKnown === word.id
                        ? "Updating..."
                        : "Already know"}
                    </button>
                  </div>
                </div>

                {/* Sentences */}
                <div className="space-y-4 border-t border-gray-200 pt-6">
                  {word.sentences
                    .sort((a, b) => {
                      const order = { easy: 0, same: 1, hard: 2 };
                      return order[a.tier] - order[b.tier];
                    })
                    .map((sentence) => (
                      <div key={sentence.id} className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                              {sentence.tier}
                            </div>
                            <div className="mb-1 text-base font-medium text-gray-900">
                              {sentence.hanzi}
                            </div>
                            <div className="mb-1 text-sm text-gray-700">
                              {sentence.pinyin}
                            </div>
                            <div className="text-sm text-gray-600">
                              {sentence.english}
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              handleAddToQuizClick("sentence", sentence.id)
                            }
                            disabled={addedItems.has(`sentence-${sentence.id}`)}
                            className="ml-4 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow-md disabled:bg-gray-50 disabled:text-gray-500"
                          >
                            {addedItems.has(`sentence-${sentence.id}`)
                              ? "✓ In quiz"
                              : t("Add to quiz")}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        ) : island.status === "generating" ? (
          <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900" />
              <p className="text-gray-700">
                Generating words and example sentences for this topic...
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white p-12 text-center shadow-sm">
            <div className="flex flex-col items-center gap-3 text-gray-500">
              <svg
                className="h-6 w-6 animate-spin text-gray-400"
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
              <p>Generating words and example sentences for this topic...</p>
            </div>
          </div>
        )}

        {/* Add to Quiz Modal */}
        {showAddToQuizModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
              <h3 className="mb-2 text-xl font-semibold text-gray-900">
                Add to Quiz
              </h3>
              <p className="mb-6 text-sm text-gray-600">
                {addToQuizContext?.type === "word"
                  ? "This will create 2 cards: Chinese → English and English → Chinese."
                  : "This will create 1 card: Chinese → English."}
              </p>

              {showCreateNew ? (
                /* Create New Quiz Island Inline */
                <div className="space-y-4">
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
                    <p className="mt-1 text-xs text-gray-500">
                      Quiz islands are for Chinese practice only
                    </p>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setShowCreateNew(false);
                        setNewQuizIslandName("");
                        if (quizIslands.length > 0) {
                          // Show select existing instead
                        } else {
                          setShowAddToQuizModal(false);
                          setAddToQuizContext(null);
                        }
                      }}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Cancel
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
                  <div className="mb-6">
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
                      className="mb-6 w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      + Create new quiz island
                    </button>
                  )}
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={() => {
                        setShowAddToQuizModal(false);
                        setSelectedQuizIslandId(
                          localStorage.getItem("lastUsedQuizIslandId") || ""
                        );
                        setAddToQuizContext(null);
                        setShowCreateNew(false);
                      }}
                      className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleAddToQuizConfirm()}
                      disabled={addingToQuiz || !selectedQuizIslandId}
                      className="rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                    >
                      {addingToQuiz ? "Adding..." : "Add"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
