"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Clock, Plus } from "lucide-react";
import { HSK_APP_LABELS } from "@/lib/hsk-app-labels";
import { useSidebar } from "@/components/app/AppLayoutClient";
import HskCurriculumSection from "@/components/hsk/HskCurriculumSection";
import AppPageLoading from "@/components/app/AppPageLoading";
import {
  JourneyDashboard,
  type JourneyPathNode,
} from "@/components/journey/JourneyDashboard";
import { toJourneyUserError } from "@/components/journey/journeyUserError";
import { useLanguage } from "@/contexts/LanguageContext";

type ApiNode = {
  id: string;
  node_type: "island" | "story" | "tone_practice";
  position: number;
  order?: number;
  name: string;
  zh?: string | null;
  hint?: string | null;
  word_count?: number | null;
  island_id?: string | null;
  story_id?: string | null;
  pronunciation_session_id?: string | null;
  completed_at?: string | null;
};

export default function JourneyPage() {
  const STORY_CACHE_KEY = "journey_story_checkpoint_cache_v1";
  const TONE_PRACTICE_CACHE_KEY = "journey_tone_practice_cache_v1";
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const isHskApp = pathname.startsWith("/hsk/app");
  const appBase = isHskApp ? "/hsk/app" : "/app";
  const { productTrack } = useSidebar();
  const { t } = useLanguage();
  const isHskCurriculum = productTrack === "hsk" || isHskApp;
  const storyRequestRef = useRef<Record<string, Promise<string | null>>>({});
  const tonePracticeRequestRef = useRef<Record<string, Promise<string | null>>>({});
  const [loading, setLoading] = useState(true);
  const [storyClickError, setStoryClickError] = useState<string | null>(null);
  const [checkpointStoryIds, setCheckpointStoryIds] = useState<Record<string, string>>({});
  const [tonePracticeSessionIds, setTonePracticeSessionIds] = useState<Record<string, string>>({});
  const [journey, setJourney] = useState<{
    id: string;
    topic: string;
    why?: string | null;
    words_per_week: number | null;
    completed_at?: string | null;
  } | null>(null);
  const [apiNodes, setApiNodes] = useState<ApiNode[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [hskLevelByIslandId, setHskLevelByIslandId] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      const [journeyRes, entRes] = await Promise.all([
        fetch("/api/journey/active", { cache: "no-store" }),
        fetch("/api/entitlements"),
      ]);
      if (journeyRes.ok) {
        const data = await journeyRes.json();
        setJourney(data.journey ?? null);
        setApiNodes(data.nodes ?? data.islands ?? []);
      }
      const ent = await entRes.json().catch(() => ({}));
      setIsPro(!!ent?.isPro);
      setLoading(false);
    };
    void load();
  }, []);

  useEffect(() => {
    if (!isHskApp || !journey?.id) return;
    let cancelled = false;
    fetch(`/api/journey/${journey.id}/hsk-levels`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.levelsByIslandId) {
          setHskLevelByIslandId(data.levelsByIslandId);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isHskApp, journey?.id]);

  useEffect(() => {
    if (!journey) return;
    try {
      const raw = window.localStorage.getItem(STORY_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      const scoped: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (key.startsWith(`${journey.id}:`) && typeof value === "string" && value) {
          scoped[key.replace(`${journey.id}:`, "")] = value;
        }
      }
      setCheckpointStoryIds(scoped);
    } catch {
      // Ignore malformed cache values and continue without checkpoint cache.
    }
  }, [journey]);

  useEffect(() => {
    if (!journey) return;
    try {
      const raw = window.localStorage.getItem(TONE_PRACTICE_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      const scoped: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (key.startsWith(`${journey.id}:`) && typeof value === "string" && value) {
          scoped[key.replace(`${journey.id}:`, "")] = value;
        }
      }
      setTonePracticeSessionIds(scoped);
    } catch {
      // Ignore malformed cache values and continue without checkpoint cache.
    }
  }, [journey]);

  const pathNodes = useMemo((): JourneyPathNode[] => {
    const sorted = [...apiNodes].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const firstIncompleteId = sorted.find((node) => !node.completed_at)?.id;
    return sorted.map((node) => {
      const islandOrder = node.order && node.order <= 10 ? node.order : node.position;
      return {
        id: node.id,
        type: node.node_type,
        position: node.position ?? 0,
        islandOrder,
        name: node.name,
        nameZh: node.zh ?? undefined,
        hint: node.hint ?? undefined,
        wordCount:
          node.node_type === "island"
            ? (node.word_count ?? (islandOrder === 1 ? 5 : 10))
            : 0,
        islandId: node.island_id ?? undefined,
        storyId: node.story_id ?? undefined,
        pronunciationSessionId: node.pronunciation_session_id ?? undefined,
        completed: !!node.completed_at,
        current: node.id === firstIncompleteId,
        paywalled: node.node_type === "island" && !isPro && islandOrder > 2,
      };
    });
  }, [apiNodes, isPro]);

  const currentNode = pathNodes.find((node) => node.current) ?? null;

  const saveCheckpointStoryId = useCallback((nodeId: string, storyId: string) => {
    if (!journey) return;
    setCheckpointStoryIds((previous) => ({
      ...previous,
      [nodeId]: storyId,
    }));
    try {
      const raw = window.localStorage.getItem(STORY_CACHE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      parsed[`${journey.id}:${nodeId}`] = storyId;
      window.localStorage.setItem(STORY_CACHE_KEY, JSON.stringify(parsed));
    } catch {
      // Ignore cache write errors; routing still works.
    }
  }, [journey]);

  const resolveCheckpointStoryId = useCallback(async (node: JourneyPathNode, quiet = false) => {
    if (!journey || node.type !== "story") return null;

    const cachedStoryId = node.storyId ?? checkpointStoryIds[node.id];
    if (cachedStoryId) return cachedStoryId;

    const pending = storyRequestRef.current[node.id];
    if (pending) return pending;

    const request = (async () => {
      const response = await fetch(
        `/api/journey/${journey.id}/story-checkpoint`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ journeyNodeId: node.id }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.storyId) {
        saveCheckpointStoryId(node.id, data.storyId);
        return data.storyId as string;
      }

      if (!quiet) {
        setStoryClickError(
          toJourneyUserError(data?.error, "Couldn't open story checkpoint yet."),
        );
      } else {
        console.warn("[journey] story prefetch", data?.error);
      }
      return null;
    })();

    storyRequestRef.current[node.id] = request;
    try {
      return await request;
    } finally {
      delete storyRequestRef.current[node.id];
    }
  }, [journey, checkpointStoryIds, saveCheckpointStoryId]);

  const saveTonePracticeSessionId = useCallback((nodeId: string, sessionId: string) => {
    if (!journey) return;
    setTonePracticeSessionIds((previous) => ({
      ...previous,
      [nodeId]: sessionId,
    }));
    try {
      const raw = window.localStorage.getItem(TONE_PRACTICE_CACHE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      parsed[`${journey.id}:${nodeId}`] = sessionId;
      window.localStorage.setItem(TONE_PRACTICE_CACHE_KEY, JSON.stringify(parsed));
    } catch {
      // Ignore cache write errors; routing still works.
    }
  }, [journey]);

  const resolveTonePracticeSessionId = useCallback(async (node: JourneyPathNode, quiet = false) => {
    if (!journey || node.type !== "tone_practice") return null;

    const cachedSessionId = node.pronunciationSessionId ?? tonePracticeSessionIds[node.id];
    if (cachedSessionId) return cachedSessionId;

    const pending = tonePracticeRequestRef.current[node.id];
    if (pending) return pending;

    const request = (async () => {
      const response = await fetch(
        `/api/journey/${journey.id}/tone-practice`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ journeyNodeId: node.id }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.sessionId) {
        saveTonePracticeSessionId(node.id, data.sessionId);
        return data.sessionId as string;
      }

      if (!quiet) {
        setStoryClickError(
          toJourneyUserError(data?.error, "Couldn't start pronunciation practice yet."),
        );
      } else {
        console.warn("[journey] tone prefetch", data?.error);
      }
      return null;
    })();

    tonePracticeRequestRef.current[node.id] = request;
    try {
      return await request;
    } finally {
      delete tonePracticeRequestRef.current[node.id];
    }
  }, [journey, tonePracticeSessionIds, saveTonePracticeSessionId]);

  useEffect(() => {
    if (!journey || !currentNode || currentNode.type !== "story") return;
    void (async () => {
      const storyId = await resolveCheckpointStoryId(currentNode, true);
      if (storyId) {
        router.prefetch(
          `${appBase}/journey/${journey.id}/story/${storyId}?journeyNodeId=${encodeURIComponent(currentNode.id)}`,
        );
      }
    })();
  }, [journey, currentNode, resolveCheckpointStoryId, router, appBase]);

  useEffect(() => {
    if (!journey || !currentNode || currentNode.type !== "tone_practice") return;
    void (async () => {
      const sessionId = await resolveTonePracticeSessionId(currentNode, true);
      if (sessionId) {
        router.prefetch(
          `/app/pronunciation/session/${sessionId}?journeyId=${encodeURIComponent(journey.id)}&journeyNodeId=${encodeURIComponent(currentNode.id)}`,
        );
      }
    })();
  }, [journey, currentNode, resolveTonePracticeSessionId, router, appBase]);

  const handleContinue = async (node: JourneyPathNode) => {
    if (!journey) return;
    setStoryClickError(null);
    if (node.type === "story") {
      const cachedStoryId = node.storyId ?? checkpointStoryIds[node.id];
      if (cachedStoryId) {
        router.push(
          `${appBase}/journey/${journey.id}/story/${cachedStoryId}?journeyNodeId=${encodeURIComponent(node.id)}`,
        );
        return;
      }

      router.push(
        `${appBase}/journey/${journey.id}/story-loading?journeyNodeId=${encodeURIComponent(node.id)}`,
      );
      return;
    }
    if (node.islandId) {
      router.push(
        node.current
          ? `${appBase}/topic-islands/${node.islandId}/learn/preparing?journeyFirst=1`
          : `${appBase}/topic-islands/${node.islandId}?journeyFirst=1`,
      );
      return;
    }
    const response = await fetch(`/api/journey/${journey.id}/start-island`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: node.islandOrder }),
    });
    const data = await response.json();
    if (data.islandId) {
      router.push(
        node.current
          ? `${appBase}/topic-islands/${data.islandId}/learn/preparing?journeyFirst=1`
          : `${appBase}/topic-islands/${data.islandId}?journeyFirst=1`,
      );
    }
  };

  const handleStoryOpen = (node: JourneyPathNode) => {
    if (!journey || node.type !== "story") return;
    setStoryClickError(null);

    const cachedStoryId = node.storyId ?? checkpointStoryIds[node.id];
    if (cachedStoryId) {
      router.push(
        `/app/journey/${journey.id}/story/${cachedStoryId}?journeyNodeId=${encodeURIComponent(node.id)}`,
      );
      return;
    }

    router.push(
      `${appBase}/journey/${journey.id}/story-loading?journeyNodeId=${encodeURIComponent(node.id)}`,
    );
  };

  const handleTonePracticeOpen = async (node: JourneyPathNode) => {
    if (!journey || node.type !== "tone_practice") return;
    setStoryClickError(null);
    const sessionId = await resolveTonePracticeSessionId(node);
    if (sessionId) {
      router.push(
        `/app/pronunciation/session/${sessionId}?journeyId=${encodeURIComponent(journey.id)}&journeyNodeId=${encodeURIComponent(node.id)}`,
      );
    }
  };

  const handleNodeActivate = (node: JourneyPathNode) => {
    if (node.type === "story") {
      handleStoryOpen(node);
      return;
    }
    if (node.type === "tone_practice") {
      void handleTonePracticeOpen(node);
      return;
    }
    void handleContinue(node);
  };

  if (isHskCurriculum) {
    return <HskCurriculumSection basePath={appBase} />;
  }

  if (loading) {
    return <AppPageLoading />;
  }

  if (!journey) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-[520px] text-center">
          <p className="mb-4 text-5xl">🗺️</p>
          <h2 className="lingo-display text-xl font-bold text-(--lingo-navy)">
            {isHskApp ? t(HSK_APP_LABELS.journey.title) : t("Start your first Journey")}
          </h2>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-(--lingo-text-muted)">
            {isHskApp
              ? t(HSK_APP_LABELS.journey.description)
              : t("Pick a topic. Get a personalised 5-island path with stories woven in to lock in the words.")}
          </p>
          <button
            type="button"
            onClick={() => router.push(`${appBase}/journey/create`)}
            className="mt-6 rounded-2xl bg-(--lingo-navy) px-7 py-3 text-sm font-bold text-white transition-colors hover:bg-(--lingo-navy-soft)"
          >
            {isHskApp ? t("Build your path →") : t("Create a Journey →")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <JourneyDashboard
      title={journey.topic}
      why={journey.why}
      completedAt={journey.completed_at}
      eyebrow={isHskApp ? t(HSK_APP_LABELS.journey.eyebrow) : t("Learning Path")}
      pathNodes={pathNodes}
      onNodeActivate={handleNodeActivate}
      clickError={storyClickError}
      hskLevelByIslandId={isHskApp ? hskLevelByIslandId : undefined}
      headerActions={
        <>
          <button
            type="button"
            onClick={() => router.push(`${appBase}/journey/past`)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-(--lingo-navy) px-5 py-3 text-sm font-bold text-white shadow-xs transition-colors hover:bg-(--lingo-navy-soft)"
          >
            <Clock className="h-3.5 w-3.5" />
            {t("My Journeys")}
          </button>
          <button
            type="button"
            onClick={() => router.push(`${appBase}/journey/create`)}
            className="inline-flex items-center justify-center gap-1.5 rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-(--lingo-navy) shadow-xs transition-colors hover:bg-(--lingo-sky-pale)"
            style={{ borderColor: "var(--lingo-border)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("New Journey")}
          </button>
        </>
      }
    />
  );
}
