"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import PreCourseLoading from "@/components/app/LearnSequence/PreCourseLoading";

type IslandProgress = {
  id: string;
  topic: string;
  status: string;
  word_target: number;
  words_selected?: number;
  sentences_generated?: number;
  sentence_tasks?: number;
};

type IslandResponse = {
  island?: IslandProgress;
  learn_ready?: boolean;
  required_sentence_count?: number;
};

export default function PrepareIslandLessonPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const islandId = params.id as string;
  const basePath = pathname.startsWith("/hsk/app") ? "/hsk/app" : "/app";
  const startedGeneration = useRef(false);
  const [data, setData] = useState<IslandResponse | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/topic-islands/${islandId}`, { cache: "no-store" });
    if (!response.ok) {
      setError("We couldn't load this island. Please return to your islands and try again.");
      return;
    }
    const next = (await response.json()) as IslandResponse;
    setData(next);
  }, [islandId]);

  const startOrResume = useCallback(async () => {
    if (startedGeneration.current) return;
    startedGeneration.current = true;
    setError("");
    const reviewVocabRaw = searchParams.get("reviewVocab");
    let reviewVocab: unknown;
    try {
      reviewVocab = reviewVocabRaw ? JSON.parse(reviewVocabRaw) : undefined;
    } catch {
      reviewVocab = undefined;
    }
    const response = await fetch(`/api/topic-islands/${islandId}/generate-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sentenceStyle: searchParams.get("sentenceStyle") ?? undefined,
        reviewVocab,
      }),
    });
    if (!response.ok && response.status !== 409) {
      const result = await response.json().catch(() => ({}));
      setError(
        typeof result.error === "string"
          ? result.error
          : "We couldn't finish the example sentences.",
      );
    }
    await load();
  }, [islandId, load, searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!data?.island || data.learn_ready) return;
    if (
      data.island.status === "draft" ||
      data.island.status === "error" ||
      data.island.status === "ready"
    ) {
      void startOrResume();
    }
  }, [data, startOrResume]);

  useEffect(() => {
    if (!data || data.learn_ready || data.island?.status === "error") return;
    const interval = window.setInterval(() => void load(), 1_500);
    return () => window.clearInterval(interval);
  }, [data, load]);

  useEffect(() => {
    if (!data?.learn_ready) return;
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("reviewVocab");
    nextParams.delete("sentenceStyle");
    const query = nextParams.toString();
    router.replace(
      `${basePath}/topic-islands/${islandId}/learn${query ? `?${query}` : ""}`,
    );
  }, [basePath, data?.learn_ready, islandId, router, searchParams]);

  const island = data?.island;
  const requiredSentences = data?.required_sentence_count ?? (island?.word_target ?? 1) * 3;
  const savedSentences = island?.sentences_generated ?? 0;
  const progress = island
    ? Math.min(
        100,
        Math.round(
          ((Math.min(island.words_selected ?? 0, island.word_target) +
            Math.min(savedSentences, requiredSentences)) /
            Math.max(1, island.word_target + requiredSentences)) *
            100,
        ),
      )
    : 0;
  const progressLabel = island
    ? `${Math.min(savedSentences, requiredSentences)} of ${requiredSentences} example sentences`
    : "Loading your island…";

  if (error) {
    return (
      <main className="hsk-app-theme lingo-body flex min-h-screen items-center justify-center bg-white px-4">
        <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <h1 className="lingo-display text-xl text-red-900">Lesson preparation paused</h1>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => {
              startedGeneration.current = false;
              void startOrResume();
            }}
            className="mt-5 rounded-xl bg-[var(--lingo-navy)] px-5 py-3 text-sm font-bold text-white"
          >
            Retry preparation
          </button>
        </div>
      </main>
    );
  }

  return (
    <PreCourseLoading
      topic={island?.topic ?? "Your topic island"}
      progressLabel={progressLabel}
      progressPercentage={progress}
    />
  );
}
