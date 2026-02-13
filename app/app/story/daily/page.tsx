"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { getLocalDateKey } from "@/lib/utils/date";
import StoryReader, {
  type StoryDetail,
  type StoryTargetWord,
} from "@/components/stories/StoryReader";
import { useOnboarding } from "@/contexts/OnboardingContext";

export default function DailyStoryPreviewPage() {
  const router = useRouter();
  const supabase = createClient();
  const { completeNudge } = useOnboarding();
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [targetWords, setTargetWords] = useState<StoryTargetWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = getLocalDateKey();

  useEffect(() => {
    const loadPreview = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/story/daily?date=${today}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.error || "Failed to generate daily story"
          );
        }

        const data = await response.json();
        const stored = data.story as StoryDetail;
        setStory(stored);

        if (stored.target_word_ids && stored.target_word_ids.length > 0) {
          const { data: wordsData, error: wordsError } = await supabase
            .from("island_words")
            .select("id, hanzi, pinyin, english, island_id")
            .in("id", stored.target_word_ids);

          if (!wordsError && wordsData) {
            const orderMap = new Map(
              stored.target_word_ids.map((id, idx) => [id, idx])
            );
            const sorted = [...wordsData].sort(
              (a, b) =>
                (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0)
            );
            setTargetWords(sorted as StoryTargetWord[]);
          }
        } else {
          setTargetWords([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load story");
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [supabase, today]);

  const handleSaveDaily = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/story/daily-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: story?.id }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || "Failed to save daily story"
        );
      }
      const data = await response.json();
      if (!data.story?.id) {
        throw new Error("Daily story saved but no ID returned");
      }
      completeNudge("read_first_story");
      completeNudge("try_story");
      router.push(`/app/story/${data.story.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save story");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-black border-t-transparent" />
          <div className="text-gray-600 text-sm font-medium">
            Generating daily story...
          </div>
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md text-center">
          <div className="mb-4 text-gray-600">
            {error || "Daily stories need vocabulary from your topic islands!"}
          </div>
          {error?.includes("topic island") && (
            <div className="mt-6">
              <p className="mb-4 text-sm text-gray-500">
                Create a topic island and generate words first, then come back for your daily story.
              </p>
              <Link
                href="/app/topic-islands"
                className="inline-flex items-center justify-center rounded-lg border border-gray-900 bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
              >
                Create Topic Island
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      {error ? (
        <div className="mx-auto max-w-3xl px-6 pt-6">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        </div>
      ) : null}
      <StoryReader
        story={story}
        targetWords={targetWords}
        onSaveDaily={handleSaveDaily}
        savingDaily={saving}
      />
    </>
  );
}

