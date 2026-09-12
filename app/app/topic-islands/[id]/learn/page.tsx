"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import LearnSequence, { learnSequenceKey } from "@/components/app/LearnSequence";
import type { LearnIsland, LearnWord } from "@/components/app/LearnSequence/types";

type LessonResponse = {
  island?: LearnIsland;
  words?: LearnWord[];
  learn_ready?: boolean;
  user_cefr_level?: string | null;
};

export default function IslandLearnPage() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const islandId = params.id as string;
  const basePath = pathname.startsWith("/hsk/app") ? "/hsk/app" : "/app";
  const [lesson, setLesson] = useState<LessonResponse | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await fetch(`/api/topic-islands/${islandId}`, { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as LessonResponse | null;
      if (!response.ok || !data?.island || !data.learn_ready) {
        const query = searchParams.toString();
        router.replace(
          `${basePath}/topic-islands/${islandId}/learn/preparing${query ? `?${query}` : ""}`,
        );
        return;
      }
      setLesson(data);
    })();
  }, [basePath, islandId, router, searchParams]);

  const leaveLesson = () => {
    localStorage.setItem(learnSequenceKey(islandId), "true");
    // Finishing all three lesson steps always returns the learner to the
    // island's complete vocabulary list, including its other sentence tiers.
    window.location.replace(`${basePath}/topic-islands/${islandId}`);
  };

  if (!lesson?.island || !lesson.words) {
    return <main className="min-h-screen bg-white" />;
  }

  return (
    <LearnSequence
      island={lesson.island}
      words={lesson.words}
      userCefrLevel={lesson.user_cefr_level}
      onComplete={leaveLesson}
    />
  );
}
