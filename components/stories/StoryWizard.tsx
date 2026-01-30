"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/browser";

type TopicIsland = {
  id: string;
  topic: string;
  word_target: number;
  created_at: string;
};

const topicSuggestions = [
  "A late-night snack run with friends",
  "Trying to fix a broken phone on a busy day",
  "Getting lost in a new city",
  "Planning a surprise birthday",
  "A rainy day coffee shop conversation",
  "Missing the last train home",
  "Cooking for roommates for the first time",
  "An awkward first date at the movies",
  "Losing your wallet and asking for help",
  "A weekend hike that goes wrong",
];

const STORAGE_KEY = "pending_story_request";

type CEFRLevel =
  | "A1-"
  | "A1"
  | "A1+"
  | "A2-"
  | "A2"
  | "A2+"
  | "B1-"
  | "B1"
  | "B1+"
  | "B2-"
  | "B2"
  | "B2+"
  | "C1-"
  | "C1"
  | "C1+";

const LEVEL_GROUPS: {
  base: "A1" | "A2" | "B1" | "B2" | "C1";
  label: string;
  description: string;
  levels: CEFRLevel[];
}[] = [
  {
    base: "A1",
    label: "Beginner",
    description:
      "Just starting out with basic phrases and survival vocabulary (HSK 1-2).",
    levels: ["A1-", "A1", "A1+"],
  },
  {
    base: "A2",
    label: "Upper beginner",
    description:
      "You can handle basics but still need support in conversations (HSK 3).",
    levels: ["A2-", "A2", "A2+"],
  },
  {
    base: "B1",
    label: "Intermediate",
    description:
      "You can talk about everyday topics but struggle with nuance (HSK 4-5).",
    levels: ["B1-", "B1", "B1+"],
  },
  {
    base: "B2",
    label: "Upper intermediate",
    description:
      "You follow most native content but miss some details (HSK 5-6).",
    levels: ["B2-", "B2", "B2+"],
  },
  {
    base: "C1",
    label: "Advanced",
    description:
      "You're fluent but still learning sophisticated vocabulary and idioms.",
    levels: ["C1-", "C1", "C1+"],
  },
];

function normalizeWords(value: string) {
  return value
    .split(/[,，\n]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function StoryWizard() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [topic, setTopic] = useState("");
  const [topicIslands, setTopicIslands] = useState<TopicIsland[]>([]);
  const [selectedIslands, setSelectedIslands] = useState<Set<string>>(
    new Set()
  );
  const [wordInput, setWordInput] = useState("");
  const [requestedWords, setRequestedWords] = useState<string[]>([]);
  const [lengthChars, setLengthChars] = useState(200);
  const [level, setLevel] = useState<CEFRLevel>("B1");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingNotice, setPendingNotice] = useState(false);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const [islandsResult, profileResult] = await Promise.all([
        supabase
          .from("topic_islands")
          .select("id, topic, word_target, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("user_profiles")
          .select("cefr_level")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (!islandsResult.error && islandsResult.data) {
        setTopicIslands(islandsResult.data);
      }
      if (!profileResult.error && profileResult.data?.cefr_level) {
        setLevel(profileResult.data.cefr_level as CEFRLevel);
      }
      setLoading(false);
    };
    loadData();
  }, [supabase]);

  useEffect(() => {
    const pendingRequestStr = localStorage.getItem(STORAGE_KEY);
    if (!pendingRequestStr) return;

    try {
      const pendingRequest = JSON.parse(pendingRequestStr);
      if (typeof pendingRequest.topic === "string") {
        setTopic(pendingRequest.topic);
      }
      if (Array.isArray(pendingRequest.requested_words)) {
        setRequestedWords(pendingRequest.requested_words);
      }
      if (typeof pendingRequest.length_chars === "number") {
        setLengthChars(pendingRequest.length_chars);
      }
      if (typeof pendingRequest.level === "string") {
        setLevel(pendingRequest.level);
      }
      if (pendingRequest.auto_submit) {
        setAutoSubmit(true);
        setStep(4);
      } else {
        setStep(2);
      }
      setPendingNotice(true);
    } catch (err) {
      console.error("Failed to parse pending story request:", err);
    }
  }, []);

  useEffect(() => {
    if (!loading && autoSubmit && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      handleSubmit();
    }
  }, [autoSubmit, loading]);

  const selectedIslandList = useMemo(
    () => Array.from(selectedIslands),
    [selectedIslands]
  );

  const canProceed = useMemo(() => {
    if (step === 1) return true; // Level selection (auto-advances on click)
    if (step === 2) return topic.trim().length > 0; // Topic input
    if (step === 3 && topicIslands.length === 0) return true; // Skip if no islands
    if (step === 3) return selectedIslands.size > 0; // Must select at least one island
    return true; // Steps 4 and 5 always proceed
  }, [step, topic, topicIslands.length, selectedIslands.size]);

  const addRequestedWords = (value: string) => {
    const next = normalizeWords(value);
    if (next.length === 0) return;
    setRequestedWords((prev) => {
      const merged = new Set(prev);
      next.forEach((item) => merged.add(item));
      return Array.from(merged);
    });
    setWordInput("");
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/story/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          island_ids: selectedIslandList,
          requested_words: requestedWords,
          level,
          length_chars: lengthChars,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || errorData.details || "Failed to create story"
        );
      }

      const data = await response.json();
      if (!data?.story?.id) {
        throw new Error("Story creation succeeded but no ID returned");
      }

      localStorage.removeItem(STORAGE_KEY);
      router.push(`/app/story/${data.story.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create story");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8">
          <button
            onClick={() => router.push("/app/stories")}
            className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            ← Back to Stories
          </button>
        </div>

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Create a custom story
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Step {step} of 5
            </p>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={`h-2 w-10 rounded-full ${
                  s <= step ? "bg-gray-900" : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        </div>
        {pendingNotice && (
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            We saved your story request. Pick Topic Islands or skip to continue.
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {step === 1 && (
            <div>
              <h2 className="mb-4 text-2xl font-bold text-gray-900">
                What best describes your level?
              </h2>
              <p className="mb-8 text-base text-gray-600">
                Choose the row that feels closest. You can always change this
                later.
              </p>

              <div className="space-y-4">
                {LEVEL_GROUPS.map((group) => (
                  <div
                    key={group.base}
                    className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between"
                  >
                    <div className="max-w-sm">
                      <h3 className="text-base font-semibold text-gray-900">
                        {group.label} ({group.base})
                      </h3>
                      <p className="mt-1 text-sm text-gray-600">
                        {group.description}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.levels.map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => {
                            setLevel(lvl);
                            setStep(2);
                          }}
                          className="rounded-full border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-gray-900 hover:bg-gray-50"
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  What do you want the story to be about?
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  rows={4}
                  placeholder="Describe the vibe, setting, or scenario..."
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm focus:border-gray-900 focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  setTopic(
                    topicSuggestions[
                      Math.floor(Math.random() * topicSuggestions.length)
                    ]
                  )
                }
                className="rounded-lg border border-gray-900 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
              >
                Random suggestion
              </button>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="mb-4 text-xl font-semibold text-gray-900">
                Pick topic islands
              </h2>
              {topicIslands.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600">
                  You don’t have any topic islands yet. Create one first.
                  <div className="mt-4">
                    <Link
                      href="/onboarding/topic-island"
                      className="inline-flex rounded-lg border border-gray-900 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-50"
                    >
                      Create a Topic Island
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {topicIslands.map((island) => {
                    const selected = selectedIslands.has(island.id);
                    return (
                      <button
                        key={island.id}
                        type="button"
                        onClick={() =>
                          setSelectedIslands((prev) => {
                            const next = new Set(prev);
                            if (next.has(island.id)) {
                              next.delete(island.id);
                            } else {
                              next.add(island.id);
                            }
                            return next;
                          })
                        }
                        className={`rounded-xl border p-4 text-left transition-all ${
                          selected
                            ? "border-gray-900 bg-gray-50"
                            : "border-gray-200 bg-white hover:border-gray-400"
                        }`}
                      >
                        <h3 className="mb-2 text-lg font-semibold text-gray-900">
                          {island.topic}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {island.word_target} target words
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                onClick={() => setStep(4)}
                className="mt-6 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-700 transition-colors hover:bg-gray-50"
              >
                Skip islands for now
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Specific words (optional)
                </label>
                <div className="flex gap-2">
                  <input
                    value={wordInput}
                    onChange={(e) => setWordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addRequestedWords(wordInput);
                      }
                    }}
                    placeholder="Type hanzi, pinyin, or English..."
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-gray-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => addRequestedWords(wordInput)}
                    className="rounded-lg border border-gray-900 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
                  >
                    Add
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Separate words with commas or new lines.
                </p>
              </div>
              {requestedWords.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {requestedWords.map((word) => (
                    <span
                      key={word}
                      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                    >
                      {word}
                      <button
                        type="button"
                        onClick={() =>
                          setRequestedWords((prev) =>
                            prev.filter((item) => item !== word)
                          )
                        }
                        className="text-gray-500 hover:text-gray-900"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-900">
                  Story length: ~{lengthChars} characters
                </label>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-500">Shorter</span>
                  <input
                    type="range"
                    min={50}
                    max={500}
                    value={lengthChars}
                    onChange={(e) => setLengthChars(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-500">Longer</span>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Current level: <span className="font-medium text-gray-900">{level}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {error ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}{" "}
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-2 underline"
            >
              Try again
            </button>
          </div>
          ) : null}

        <div className="mt-8 flex items-center justify-between">
          {step > 1 && (
            <button
              type="button"
              onClick={() => setStep((prev) => Math.max(1, prev - 1))}
              className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Back
            </button>
          )}
          {step === 1 && <div />}
          {step < 5 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => Math.min(5, prev + 1))}
              disabled={!canProceed}
              className="rounded-lg border border-gray-900 bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !canProceed}
              className="rounded-lg border border-gray-900 bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create story"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

