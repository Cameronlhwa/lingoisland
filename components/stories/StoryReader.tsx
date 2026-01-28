"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import StorySideChat from "@/components/stories/StorySideChat";
import type { IslandChatSelectedWord } from "@/components/IslandSideChat";
import { pinyin } from "pinyin-pro";
import SpeakerButton from "@/components/app/SpeakerButton";

export type StoryDetail = {
  id: string;
  title: string;
  level: string;
  kind: "daily" | "custom";
  date: string | null;
  created_at: string;
  length_chars: number;
  saved?: boolean;
  story_zh: string;
  story_en: string | null;
  story_pinyin: string | null;
  source_island_ids: string[];
  target_word_ids: string[];
  topic: string | null;
};

export type StoryTargetWord = {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string;
  island_id?: string;
};

function formatDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

export default function StoryReader({
  story,
  targetWords,
  onSaveDaily,
  savingDaily = false,
}: {
  story: StoryDetail;
  targetWords: StoryTargetWord[];
  onSaveDaily?: () => void;
  savingDaily?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [showPinyin, setShowPinyin] = useState(false);
  const [showEnglish, setShowEnglish] = useState(Boolean(story.story_en));
  const [storyPinyin, setStoryPinyin] = useState(story.story_pinyin || "");
  const [storyEnglish, setStoryEnglish] = useState(story.story_en || "");
  const [titlePinyin, setTitlePinyin] = useState("");
  const [pinyinLoading, setPinyinLoading] = useState(false);
  const [englishLoading, setEnglishLoading] = useState(false);
  const [quizIslands, setQuizIslands] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [showAddToQuizModal, setShowAddToQuizModal] = useState(false);
  const [selectedQuizIslandId, setSelectedQuizIslandId] = useState<string>("");
  const [addingToQuiz, setAddingToQuiz] = useState(false);
  const [addToQuizContext, setAddToQuizContext] = useState<{
    type: "word";
    sourceId: string;
  } | null>(null);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newQuizIslandName, setNewQuizIslandName] = useState("");
  const [creatingQuizIsland, setCreatingQuizIsland] = useState(false);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [askAIWord, setAskAIWord] = useState<IslandChatSelectedWord | null>(
    null
  );

  const primaryIslandId = story.source_island_ids?.[0] || "";
  const hasPinyin = useMemo(
    () => Boolean(storyPinyin || story.story_pinyin),
    [storyPinyin, story.story_pinyin]
  );
  const hasEnglish = Boolean(storyEnglish || story.story_en);

  const storyPinyinParts = useMemo(() => {
    if (!showPinyin) return [];
    const chars = Array.from(story.story_zh || "");
    const pinyinParts = pinyin(story.story_zh || "", {
      toneType: "symbol",
      type: "array",
      nonZh: "consecutive",
    });
    if (!Array.isArray(pinyinParts)) {
      return [];
    }
    if (pinyinParts.length === chars.length) {
      return chars.map((char, index) => ({
        char,
        py: pinyinParts[index] || "",
      }));
    }
    const filtered = pinyinParts.filter((part) => part !== "");
    return chars.map((char, index) => ({
      char,
      py: filtered[index] || "",
    }));
  }, [showPinyin, story.story_zh]);

  const titlePinyinParts = useMemo(() => {
    if (!showPinyin) return [];
    const chars = Array.from(story.title || "");
    const pinyinParts = pinyin(story.title || "", {
      toneType: "symbol",
      type: "array",
      nonZh: "consecutive",
    });
    if (!Array.isArray(pinyinParts) || pinyinParts.length !== chars.length) {
      return [];
    }
    return chars.map((char, index) => ({
      char,
      py: pinyinParts[index] || "",
    }));
  }, [showPinyin, story.title]);
  useEffect(() => {
    setShowPinyin(false);
    setStoryPinyin(story.story_pinyin || "");
    setShowEnglish(Boolean(story.story_en));
    setStoryEnglish(story.story_en || "");
    setTitlePinyin("");
  }, [story.id, story.story_en, story.story_pinyin]);

  const handleGeneratePinyin = async () => {
    setPinyinLoading(true);
    try {
      const [storyRes, titleRes] = await Promise.all([
        fetch("/api/pinyin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: story.story_zh }),
        }),
        fetch("/api/pinyin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: story.title }),
        }),
      ]);

      if (!storyRes.ok || !titleRes.ok) {
        throw new Error("Failed to generate pinyin");
      }

      const storyData = await storyRes.json();
      const titleData = await titleRes.json();

      const nextStoryPinyin = storyData.pinyin || "";
      const nextTitlePinyin = titleData.pinyin || "";

      setStoryPinyin(nextStoryPinyin);
      setTitlePinyin(nextTitlePinyin);
      setShowPinyin(true);

      if (nextStoryPinyin) {
        await supabase
          .from("stories")
          .update({ story_pinyin: nextStoryPinyin })
          .eq("id", story.id);
      }
    } catch (error) {
      console.error("Error generating pinyin:", error);
      alert("Failed to generate pinyin. Please try again.");
    } finally {
      setPinyinLoading(false);
    }
  };

  useEffect(() => {
    const loadQuizIslands = async () => {
      try {
        const response = await fetch("/api/quiz-islands");
        if (!response.ok) throw new Error("Failed to load quiz islands");
        const data = await response.json();
        setQuizIslands(data.quizIslands || []);
        const lastUsed = localStorage.getItem("lastUsedQuizIslandId");
        if (
          lastUsed &&
          data.quizIslands?.some((qi: { id: string }) => qi.id === lastUsed)
        ) {
          setSelectedQuizIslandId(lastUsed);
        } else if (data.quizIslands && data.quizIslands.length > 0) {
          setSelectedQuizIslandId(data.quizIslands[0].id);
        }
      } catch (error) {
        console.error("Error loading quiz islands:", error);
      }
    };
    loadQuizIslands();
  }, []);

  const handleAddToQuizClick = (sourceId: string) => {
    if (addedItems.has(`word-${sourceId}`)) return;
    if (quizIslands.length === 0) {
      setShowCreateNew(true);
      setAddToQuizContext({ type: "word", sourceId });
      setShowAddToQuizModal(true);
      return;
    }
    setAddToQuizContext({ type: "word", sourceId });
    setShowAddToQuizModal(true);
  };

  const handleCreateNewQuizIsland = async () => {
    if (!newQuizIslandName.trim()) return;
    setCreatingQuizIsland(true);
    try {
      const response = await fetch("/api/quiz-islands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newQuizIslandName.trim() }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create quiz island");
      }
      const data = await response.json();
      const newQuizIsland = data.quizIsland;
      setQuizIslands((prev) => [newQuizIsland, ...prev]);
      setSelectedQuizIslandId(newQuizIsland.id);
      setShowCreateNew(false);
      setNewQuizIslandName("");
      localStorage.setItem("lastUsedQuizIslandId", newQuizIsland.id);
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
          createReverse: true,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add to quiz");
      }
      const itemKey = `word-${addToQuizContext.sourceId}`;
      setAddedItems((prev) => {
        const next = new Set(prev);
        next.add(itemKey);
        return next;
      });
      localStorage.setItem("lastUsedQuizIslandId", quizIslandId);
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

  const dateLabel = formatDate(story.date || story.created_at);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex w-full">
        <div className="flex-1 min-w-0 p-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 flex items-center justify-between">
              <button
                onClick={() => router.push("/app/stories")}
                className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
              >
                ← Back to Stories
              </button>
              <div className="flex items-center gap-4">
                {story.source_island_ids?.length ? (
                  <button
                    onClick={() =>
                      router.push(
                        `/app/topic-islands/${story.source_island_ids[0]}`
                      )
                    }
                    className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
                  >
                    View Topic Island
                  </button>
                ) : null}
                {story.kind === "daily" && !story.saved && onSaveDaily ? (
                  <button
                    onClick={onSaveDaily}
                    disabled={savingDaily}
                    className="rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                  >
                    {savingDaily ? "Saving..." : "Save Daily Story"}
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
              <div className="mb-6">
                <div className="mb-3 flex items-center gap-3 text-sm text-gray-600">
                  <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
                    {story.kind === "daily" ? "Daily" : "Custom"}
                  </span>
                  <span>Level: {story.level}</span>
                  {dateLabel ? <span>{dateLabel}</span> : null}
                </div>
                {showPinyin && titlePinyinParts.length > 0 ? (
                  <div className="mt-2">
                    <div className="mb-2 flex items-center gap-2">
                      <SpeakerButton text={story.title} size="md" />
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-3">
                      {titlePinyinParts.map((part, index) => (
                        <span
                          key={`${part.char}-${index}`}
                          className="flex flex-col items-center text-sm text-gray-600"
                        >
                          <span className="text-xs text-gray-500">{part.py}</span>
                          <span className="text-lg font-semibold text-gray-900">
                            {part.char}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold text-gray-900">
                      {story.title}
                    </h1>
                    <SpeakerButton text={story.title} size="lg" />
                  </div>
                )}
                {story.topic ? (
                  <p className="mt-2 text-sm text-gray-500">
                    Topic: {story.topic}
                  </p>
                ) : null}
                {story.source_island_ids?.length ? (
                  <p className="mt-1 text-xs text-gray-400">
                    Islands: {story.source_island_ids.length}
                  </p>
                ) : null}
              </div>

              <div className="mb-6 flex flex-wrap gap-3">
                {hasPinyin ? (
                  <button
                    onClick={() => setShowPinyin((v) => !v)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                      showPinyin
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    {showPinyin ? "Hide" : "Show"} Pinyin
                  </button>
                ) : (
                  <button
                    onClick={handleGeneratePinyin}
                    disabled={pinyinLoading}
                    className="rounded-full border border-gray-900 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    {pinyinLoading ? "Generating..." : "Generate Pinyin"}
                  </button>
                )}
                {hasEnglish ? (
                  <button
                    onClick={() => setShowEnglish((v) => !v)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                      showEnglish
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    {showEnglish ? "Hide" : "Show"} English
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      setEnglishLoading(true);
                      try {
                        const response = await fetch("/api/story/english", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            storyId: story.id,
                            text: story.story_zh,
                          }),
                        });
                        if (!response.ok) {
                          const errorData = await response
                            .json()
                            .catch(() => ({}));
                          throw new Error(
                            errorData.error || "Failed to generate English"
                          );
                        }
                        const data = await response.json();
                        if (data.english) {
                          setStoryEnglish(data.english);
                          setShowEnglish(true);
                        }
                      } catch (error) {
                        console.error("Error generating English:", error);
                        alert("Failed to generate English. Please try again.");
                      } finally {
                        setEnglishLoading(false);
                      }
                    }}
                    disabled={englishLoading}
                    className="rounded-full border border-gray-900 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    {englishLoading ? "Generating..." : "Generate English"}
                  </button>
                )}
              </div>

              <div className="space-y-6">
                <div className="mb-3 flex items-center gap-2">
                  <SpeakerButton text={story.story_zh} size="md" />
                  <span className="text-sm text-gray-500">
                    Play full story
                  </span>
                </div>
                {showPinyin && storyPinyinParts.length > 0 ? (
                  <div className="flex flex-wrap gap-x-2 gap-y-4 text-gray-900">
                    {storyPinyinParts.map((part, index) => (
                      <span
                        key={`${part.char}-${index}`}
                        className="flex flex-col items-center text-lg"
                      >
                        <span className="text-xs text-gray-500">{part.py}</span>
                        <span className="text-2xl leading-relaxed">
                          {part.char}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-2xl leading-relaxed text-gray-900">
                    {story.story_zh}
                  </div>
                )}
                {showEnglish && (storyEnglish || story.story_en) ? (
                  <div className="text-base leading-relaxed text-gray-600">
                    {storyEnglish || story.story_en}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-10">
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                Target words
              </h2>
              {targetWords.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
                  No target words were attached to this story.
                </div>
              ) : (
                <div className="space-y-4">
                  {targetWords.map((word) => (
                    <div
                      key={word.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-2xl font-semibold text-gray-900">
                            {word.hanzi}
                          </div>
                          <SpeakerButton text={word.hanzi} size="md" />
                        </div>
                        <div className="text-sm text-gray-600">
                          {word.pinyin}
                        </div>
                        <div className="text-sm text-gray-500">
                          {word.english}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            setAskAIWord({
                              hanzi: word.hanzi,
                              pinyin: word.pinyin,
                              english: word.english,
                            })
                          }
                          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
                          title="Ask AI about this word"
                        >
                          Ask AI
                        </button>
                        <button
                          onClick={() => handleAddToQuizClick(word.id)}
                          disabled={addedItems.has(`word-${word.id}`)}
                          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow-md disabled:bg-gray-50 disabled:text-gray-500"
                        >
                          {addedItems.has(`word-${word.id}`)
                            ? "✓ In quiz"
                            : "Add to quiz"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {showAddToQuizModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
                  <h3 className="mb-2 text-xl font-semibold text-gray-900">
                    Add to Quiz
                  </h3>
                  <p className="mb-6 text-sm text-gray-600">
                    This will create 2 cards: Chinese → English and English →
                    Chinese.
                  </p>

                  {showCreateNew ? (
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
                            if (quizIslands.length === 0) {
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
                          disabled={
                            creatingQuizIsland || !newQuizIslandName.trim()
                          }
                          className="rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
                        >
                          {creatingQuizIsland ? "Creating..." : "Create & Add"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-6">
                        <select
                          value={selectedQuizIslandId}
                          onChange={(e) =>
                            setSelectedQuizIslandId(e.target.value)
                          }
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

        <StorySideChat storyId={story.id} storyTitle={story.title} />
      </div>
    </div>
  );
}
