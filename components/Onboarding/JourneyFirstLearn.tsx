"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LearnSequence, {
  learnSequenceKey,
} from "@/components/app/LearnSequence";
import PreCourseLoading from "@/components/app/LearnSequence/PreCourseLoading";
import type { LearnIsland, LearnWord } from "@/components/app/LearnSequence/types";
import LearnSummary from "@/components/Onboarding/LearnSummary";
import { CharacterSetProvider } from "@/contexts/CharacterSetContext";
import { hskLabelForCefr } from "@/lib/levelBands";
import {
  buildUpgradePageUrl,
  markUpgradePending,
  writeUpgradeSnapshot,
  type JourneyNodeSnapshot,
} from "@/lib/onboarding/onboardingCheckoutStorage";

type JourneyContext = {
  name: string;
  journeyTopic: string;
  wordsPerWeek: number;
  lockedIslands: JourneyNodeSnapshot[];
};

type IslandPayload = LearnIsland & {
  status: string;
  word_target?: number;
  words_selected?: number;
  sentence_attempts?: number;
  sentence_tasks?: number;
};

/**
 * First-lesson experience for public journey onboarding.
 * Stays on /onboarding/journey so users never flash through /app chrome.
 */
export default function JourneyFirstLearn({
  islandId,
  fallbackLevel,
}: {
  islandId: string;
  fallbackLevel: string;
}) {
  return (
    <CharacterSetProvider>
      <JourneyFirstLearnInner
        islandId={islandId}
        fallbackLevel={fallbackLevel}
      />
    </CharacterSetProvider>
  );
}

function JourneyFirstLearnInner({
  islandId,
  fallbackLevel,
}: {
  islandId: string;
  fallbackLevel: string;
}) {
  const router = useRouter();
  const [island, setIsland] = useState<IslandPayload | null>(null);
  const [words, setWords] = useState<LearnWord[]>([]);
  const [userCefrLevel, setUserCefrLevel] = useState<string | null | undefined>(
    undefined,
  );
  const [journeyContext, setJourneyContext] = useState<JourneyContext | null>(
    null,
  );
  const [phase, setPhase] = useState<"loading" | "learn" | "summary">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== "loading") return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/topic-islands/${islandId}`);
        if (!res.ok) {
          throw new Error("Could not load your lesson");
        }
        const data = await res.json();
        if (cancelled) return;

        const nextIsland = data.island as IslandPayload;
        const nextWords = (data.words ?? []) as LearnWord[];
        setIsland(nextIsland);
        setWords(nextWords);
        setUserCefrLevel(
          typeof data.user_cefr_level === "string"
            ? data.user_cefr_level
            : null,
        );
        setJourneyContext(data.journeyContext ?? null);

        if (nextIsland?.status === "ready" && nextWords.length >= 3) {
          setPhase("learn");
        }
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load lesson");
        }
      }
    };

    void load();
    const interval = setInterval(() => {
      void load();
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [islandId, phase]);

  const wordsSelected = island?.words_selected ?? words.length;
  const wordTarget = island?.word_target ?? 5;
  const sentenceAttempts = island?.sentence_attempts ?? 0;
  const totalSentenceTasks = Math.max(1, island?.sentence_tasks ?? 1);
  const wordProgress = wordTarget
    ? Math.min(wordsSelected / wordTarget, 1)
    : 0;
  const sentenceProgress = Math.min(sentenceAttempts / totalSentenceTasks, 1);
  const progressPercentage =
    island?.status === "ready"
      ? 100
      : wordProgress < 1
        ? Math.round(30 * wordProgress)
        : Math.round(30 + 70 * sentenceProgress);
  const progressLabel =
    island?.status === "ready"
      ? "Ready"
      : wordProgress < 1
        ? `Selecting words (${wordsSelected}/${wordTarget})`
        : `Generating sentences (${sentenceAttempts}/${totalSentenceTasks})`;

  if (error && !island) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
        style={{ background: "#D6EEF8" }}
      >
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          className="mt-4 text-sm font-medium text-[#2176AE] underline"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    );
  }

  if (phase === "loading" || !island || userCefrLevel === undefined) {
    return (
      <PreCourseLoading
        topic={island?.topic ?? "Your first island"}
        level={hskLabelForCefr(island?.level ?? fallbackLevel)}
        progressLabel={progressLabel}
        progressPercentage={island ? progressPercentage : 12}
      />
    );
  }

  if (phase === "summary") {
    const summaryCount = (island.level ?? "")
      .trim()
      .toUpperCase()
      .startsWith("A0")
      ? 5
      : 3;
    return (
      <LearnSummary
        words={words.slice(0, summaryCount)}
        islandLevel={island.level}
        topic={island.topic}
        onContinue={() => {
          writeUpgradeSnapshot({
            v: 1,
            islandId: island.id,
            topic: island.topic,
            journeyTopic: journeyContext?.journeyTopic,
            islandLevel: island.level,
            islandName: journeyContext?.name,
            wordsLearned: island.word_target ?? 3,
            wordsPerWeek: journeyContext?.wordsPerWeek ?? 40,
            lockedIslands: journeyContext?.lockedIslands,
            plan: "monthly",
          });
          markUpgradePending();
          router.push(buildUpgradePageUrl(island.id));
        }}
      />
    );
  }

  return (
    <LearnSequence
      island={island}
      words={words}
      userCefrLevel={userCefrLevel}
      onComplete={() => {
        localStorage.setItem(learnSequenceKey(island.id), "done");
        setPhase("summary");
      }}
    />
  );
}
