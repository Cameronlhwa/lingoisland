"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import LearnSequence, { learnSequenceKey } from "@/components/app/LearnSequence";
import type { LearnIsland, LearnWord } from "@/components/app/LearnSequence/types";
import JourneyLessonPlayer, { type LessonSnapshot } from "@/components/journey/teaching/JourneyLessonPlayer";
import PreCourseLoading from "@/components/app/LearnSequence/PreCourseLoading";

type LessonResponse = {
  teaching?: LessonSnapshot | null;
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
  const preparationQuery = useRef(searchParams.toString());
  preparationQuery.current = searchParams.toString();
  const [error, setError] = useState("");
  const [lesson, setLesson] = useState<LessonResponse | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLesson(null);
    setError("");
    void (async () => {
      try {
        const response = await fetch(`/api/topic-islands/${islandId}`, {
          cache: "no-store", signal: controller.signal,
        });
        const data = (await response.json().catch(() => null)) as LessonResponse | null;
        if (!response.ok || !data?.island) throw new Error("We couldn’t load your lesson. Please try again.");
        if (controller.signal.aborted) return;
        if (!data.learn_ready) {
          const query = preparationQuery.current;
          router.replace(`${basePath}/topic-islands/${islandId}/learn/preparing${query ? `?${query}` : ""}`);
          return;
        }
        setLesson(data);
      } catch (error) {
        if (!controller.signal.aborted) setError((error as Error).message);
      }
    })();
    return () => controller.abort();
  }, [basePath, islandId, router]);

  const leaveLesson = () => {
    localStorage.setItem(learnSequenceKey(islandId), "true");
    // Finishing all three lesson steps always returns the learner to the
    // island's complete vocabulary list, including its other sentence tiers.
    window.location.replace(`${basePath}/topic-islands/${islandId}`);
  };

  if (error) return <div className="mx-auto max-w-xl p-8" role="alert"><p>{error}</p><button className="mt-4 underline" onClick={() => window.location.reload()}>Try again</button></div>;

  if (!lesson?.island || !lesson.words) {
    return <PreCourseLoading />;
  }

  if (lesson.teaching) return <JourneyLessonPlayer key={islandId} islandId={islandId} initial={lesson.teaching} onExit={() => router.replace(`${basePath}/topic-islands/${islandId}`)} onComplete={leaveLesson} />;

  return (
    <LearnSequence
      island={lesson.island}
      words={lesson.words}
      userCefrLevel={lesson.user_cefr_level}
      onComplete={leaveLesson}
    />
  );
}
