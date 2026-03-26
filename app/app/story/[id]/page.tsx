"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import StoryReader, {
  type StoryDetail,
  type StoryTargetWord,
} from "@/components/stories/StoryReader";
import { useOnboarding } from "@/contexts/OnboardingContext";

export default function StoryDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const storyId = params.id as string;
  const journeyId = searchParams.get("journeyId");
  const journeyNodeId = searchParams.get("journeyNodeId");
  const supabase = createClient();
  const { completeNudge } = useOnboarding();
  const checkpointCompleteRef = useRef<string | null>(null);
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [targetWords, setTargetWords] = useState<StoryTargetWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!journeyId || !journeyNodeId) return;
    const key = `${journeyId}:${journeyNodeId}`;
    if (checkpointCompleteRef.current === key) return;
    checkpointCompleteRef.current = key;

    void fetch(`/api/journey/${journeyId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ journeyIslandId: journeyNodeId }),
      keepalive: true,
    }).catch(() => {
      // If this background call fails, story reading should still proceed.
    });
  }, [journeyId, journeyNodeId]);

  useEffect(() => {
    const loadStory = async () => {
      setLoading(true);
      setError(null);
      const { data, error: storyError } = await supabase
        .from("stories")
        .select("*")
        .eq("id", storyId)
        .single();

      if (storyError || !data) {
        setError(storyError?.message || "Story not found");
        setLoading(false);
        return;
      }

      setStory(data as StoryDetail);
      completeNudge("read_first_story");
      completeNudge("try_story");

      if (data.target_word_ids && data.target_word_ids.length > 0) {
        const { data: wordsData, error: wordsError } = await supabase
          .from("island_words")
          .select("id, hanzi, pinyin, english, island_id")
          .in("id", data.target_word_ids);

        if (!wordsError && wordsData) {
          const orderMap = new Map<string, number>(
            data.target_word_ids.map((id: string, idx: number) => [id, idx])
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

      setLoading(false);
    };
    if (storyId) {
      loadStory();
    }
  }, [storyId, supabase]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">Loading story...</div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">{error || "Story not found"}</div>
      </div>
    );
  }

  return <StoryReader story={story} targetWords={targetWords} />;
}
