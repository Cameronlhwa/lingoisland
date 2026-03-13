"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

const STORAGE_KEY = "pending_topic_island_request";

/**
 * Module-level flag — survives React Strict Mode's double-mount because the
 * module is never re-evaluated between mounts.  useRef() would reset to false
 * on the second mount, which caused a race where localStorage was already
 * cleared and the page redirected to the list instead of the new island.
 */
let _loadingInProgress = false;

export default function TopicIslandLoadingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [topic, setTopic] = useState<string>("");
  const [level, setLevel] = useState<string>("B1");
  const [statusText, setStatusText] = useState("Setting up your island…");

  useEffect(() => {
    // Skip the Strict-Mode second invocation
    if (_loadingInProgress) return;
    _loadingInProgress = true;

    // Grab display values immediately for the skeleton UI
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.topic) setTopic(parsed.topic);
        if (parsed.cefrLevel) setLevel(parsed.cefrLevel);
      }
    } catch {}

    processPendingRequest().finally(() => {
      // Reset so a future real navigation to this page works correctly
      _loadingInProgress = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const processPendingRequest = async () => {
    const pendingRequestStr = localStorage.getItem(STORAGE_KEY);
    if (!pendingRequestStr) {
      router.replace("/app/topic-islands");
      return;
    }

    let pendingRequest: Record<string, unknown>;
    try {
      pendingRequest = JSON.parse(pendingRequestStr);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      router.replace("/app/topic-islands");
      return;
    }

    setStatusText("Signing you in…");

    // Wait for anonymous session to propagate (may take a few retries)
    let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"] = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const result = await supabase.auth.getUser();
      user = result.data.user;
      if (user) break;
      await new Promise((r) => setTimeout(r, 500));
    }

    if (!user) {
      localStorage.removeItem(STORAGE_KEY);
      router.replace("/app/topic-islands");
      return;
    }

    // Update CEFR level on profile
    if (pendingRequest.cefrLevel) {
      setStatusText("Saving your preferences…");
      await supabase
        .from("user_profiles")
        .update({ cefr_level: pendingRequest.cefrLevel })
        .eq("user_id", user.id);
    }

    setStatusText("Building your topic island…");

    const grammarTarget =
      pendingRequest.wantsGrammar && pendingRequest.grammarCount
        ? (pendingRequest.grammarCount as number)
        : 0;

    // Remove from storage now so HomeDashboard can't race to pick it up
    localStorage.removeItem(STORAGE_KEY);

    let islandId: string;
    try {
      const createResponse = await fetch("/api/topic-islands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: pendingRequest.topic,
          level: pendingRequest.cefrLevel || "B1",
          wordTarget: pendingRequest.wordCount,
          grammarTarget,
        }),
      });

      if (!createResponse.ok) {
        const err = await createResponse.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create topic island");
      }

      const data = await createResponse.json();
      if (!data.islandId) throw new Error("No island ID returned");
      islandId = data.islandId;
    } catch (err) {
      console.error("[loading] Error creating island:", err);
      router.replace("/app/topic-islands");
      return;
    }

    setStatusText("Generating words and sentences…");

    // Reset the hint so it shows fresh on every newly created island
    localStorage.removeItem("island_hint_dismissed");

    // Fire-and-forget — island detail page shows its own progress bar
    fetch(`/api/topic-islands/${islandId}/generate-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchSize: 5 }),
    }).catch((err) => console.error("Error starting generation:", err));

    router.replace(`/app/topic-islands/${islandId}`);
  };

  return (
    <div className="min-h-screen bg-white px-6 py-4 md:px-16 md:py-8">
      <div className="mx-auto max-w-3xl">
        {/* Nav row */}
        <div className="mb-6 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-300">← Back to Topic Islands</span>
        </div>

        {/* Title — real topic name or skeleton */}
        {topic ? (
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900">{topic}</h1>
        ) : (
          <div className="mb-4 h-10 w-64 animate-pulse rounded-lg bg-gray-200" />
        )}

        {/* Level / live status */}
        <div className="mb-6 space-y-1 text-sm text-gray-500">
          <p>Level: {level}</p>
          <p className="flex items-center gap-2">
            Status:&nbsp;
            <span className="inline-flex items-center gap-1.5 text-gray-700">
              <svg
                className="h-3.5 w-3.5 animate-spin text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              {statusText}
            </span>
          </p>
        </div>

        {/* Indeterminate progress bar */}
        <div className="mb-8 h-2 w-full overflow-hidden rounded-full bg-gray-200">
          <div className="h-full w-1/3 origin-left animate-[progress-indeterminate_1.5s_ease-in-out_infinite] rounded-full bg-gray-800" />
        </div>

        {/* Skeleton word cards — fade out toward bottom for depth */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              style={{ opacity: 1 - i * 0.12 }}
            >
              <div className="mb-3 flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-8 w-24 animate-pulse rounded bg-gray-200" />
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
                  <div className="h-4 w-28 animate-pulse rounded bg-gray-100" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-24 animate-pulse rounded-lg bg-gray-100" />
                  <div className="h-8 w-20 animate-pulse rounded-lg bg-gray-100" />
                </div>
              </div>
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
