"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import LearnChat from "@/components/app/LearnSequence/LearnChat";
import { useLearnLevel } from "@/components/app/LearnSequence/useLearnLevel";
import {
  pickLearnWords,
  type LearnIsland,
  type LearnWord,
} from "@/components/app/LearnSequence/types";

export default function IslandChatPage() {
  const { id } = useParams();
  const islandId = id as string;
  const router = useRouter();
  const [island, setIsland] = useState<LearnIsland | null>(null);
  const [words, setWords] = useState<LearnWord[]>([]);
  const [userCefrLevel, setUserCefrLevel] = useState<string | null | undefined>(
    undefined,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/topic-islands/${islandId}`);
        if (!res.ok) throw new Error("Failed to load island");
        const data = await res.json();
        setIsland(data.island);
        setWords(data.words ?? []);
        setUserCefrLevel(
          typeof data.user_cefr_level === "string" ? data.user_cefr_level : null,
        );
      } catch (error) {
        console.error("Error loading island chat:", error);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [islandId]);

  const learnWords = useMemo(() => pickLearnWords(words, 5), [words]);
  const learnLevel = useLearnLevel(island, userCefrLevel);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#D6EEF8] text-gray-500">
        Loading…
      </div>
    );
  }

  if (!island) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#D6EEF8] px-6 text-center">
        <p className="text-gray-600">Island not found.</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm font-semibold text-[#2176AE]"
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#D6EEF8]">
      <div className="flex items-center gap-3 border-b bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm font-semibold text-[#2176AE]"
        >
          ← Back
        </button>
        <div className="min-w-0">
          <h1
            className="text-base font-semibold text-[#071E2E]"
            style={{ fontFamily: "'Lora', Georgia, serif" }}
          >
            Chat with <span className="text-[#2176AE]">华华</span>
          </h1>
          <p className="truncate text-xs text-gray-500">{island.topic}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <LearnChat
          words={learnWords}
          allIslandWords={words}
          island={island}
          learnLevel={learnLevel}
          fillContainer
          onComplete={() => router.back()}
        />
      </div>
    </div>
  );
}
