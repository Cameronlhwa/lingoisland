"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

const STORY_CACHE_KEY = "journey_story_checkpoint_cache_v1";

export default function StoryLoadingPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const journeyId = params?.id;
  const journeyNodeId = useMemo(
    () => searchParams.get("journeyNodeId"),
    [searchParams],
  );

  useEffect(() => {
    if (!journeyId || !journeyNodeId) {
      setError("Missing story checkpoint details.");
      return;
    }

    let active = true;

    const openStory = async () => {
      setError(null);

      const response = await fetch(
        `/api/journey/${journeyId}/story-checkpoint`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ journeyNodeId }),
        },
      );

      const data = await response.json().catch(() => ({}));
      if (!active) return;

      if (response.ok && data.storyId) {
        try {
          const raw = window.localStorage.getItem(STORY_CACHE_KEY);
          const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
          parsed[`${journeyId}:${journeyNodeId}`] = data.storyId;
          window.localStorage.setItem(STORY_CACHE_KEY, JSON.stringify(parsed));
        } catch {
          // Ignore cache write failures and continue.
        }
        router.replace(
          `/app/journey/${journeyId}/story/${data.storyId}?journeyNodeId=${encodeURIComponent(journeyNodeId)}`,
        );
        return;
      }

      setError(
        typeof data?.error === "string"
          ? data.error
          : "We couldn't open that story checkpoint.",
      );
    };

    void openStory();

    return () => {
      active = false;
    };
  }, [journeyId, journeyNodeId, retryNonce, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-600">
          Story Checkpoint
        </p>
        <h1 className="mt-2 text-lg font-black text-amber-950">
          Opening your story...
        </h1>
        <p className="mt-2 text-sm text-amber-800">
          Hang tight while we prepare it.
        </p>
        {error && (
          <>
            <p className="mt-4 text-xs font-semibold text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => setRetryNonce((value) => value + 1)}
              className="mt-3 rounded-lg bg-amber-500 px-4 py-2 text-xs font-black text-white"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => router.push("/app/journey")}
              className="ml-2 mt-3 rounded-lg border border-amber-300 bg-white px-4 py-2 text-xs font-black text-amber-700"
            >
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
