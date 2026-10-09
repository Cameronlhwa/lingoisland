"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams, usePathname } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import AppPageLoading from "@/components/app/AppPageLoading";
import {
  JourneyDashboard,
  type JourneyPathNode,
} from "@/components/journey/JourneyDashboard";
import { toJourneyUserError } from "@/components/journey/journeyUserError";
import { useLanguage } from "@/contexts/LanguageContext";

const STORY_CACHE_KEY = "journey_story_checkpoint_cache_v1";
const TONE_PRACTICE_CACHE_KEY = "journey_tone_practice_cache_v1";

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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function JourneyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname() ?? "";
  const appBase = pathname.startsWith("/hsk/app") ? "/hsk/app" : "/app";
  const journeyId = params?.id as string;
  const { t } = useLanguage();
  const storyRequestRef = useRef<Record<string, Promise<string | null>>>({});
  const tonePracticeRequestRef = useRef<Record<string, Promise<string | null>>>({});

  const [loading, setLoading] = useState(true);
  const [journey, setJourney] = useState<{
    id: string;
    topic: string;
    why?: string | null;
    completed_at: string | null;
    created_at: string;
    curriculum_unit_id?: string | null;
  } | null>(null);
  const [apiNodes, setApiNodes] = useState<ApiNode[]>([]);
  const [storyClickError, setStoryClickError] = useState<string | null>(null);
  const [checkpointStoryIds, setCheckpointStoryIds] = useState<Record<string, string>>({});
  const [tonePracticeSessionIds, setTonePracticeSessionIds] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!journeyId) return;
    void (async () => {
      const res = await fetch(`/api/journey/${journeyId}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setJourney(data.journey ?? null);
        setApiNodes(data.nodes ?? data.islands ?? []);
      }
      setLoading(false);
    })();
  }, [journeyId]);

  useEffect(() => {
    if (!journey) return;
    try {
      const raw = window.localStorage.getItem(STORY_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      const scoped: Record<string, string> = {};
      for (const [key, val] of Object.entries(parsed)) {
        if (key.startsWith(`${journey.id}:`) && val) {
          scoped[key.slice(journey.id.length + 1)] = val;
        }
      }
      setCheckpointStoryIds(scoped);
    } catch {
      // ignore malformed cache
    }
  }, [journey]);

  useEffect(() => {
    if (!journey) return;
    try {
      const raw = window.localStorage.getItem(TONE_PRACTICE_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      const scoped: Record<string, string> = {};
      for (const [key, val] of Object.entries(parsed)) {
        if (key.startsWith(`${journey.id}:`) && val) {
          scoped[key.slice(journey.id.length + 1)] = val;
        }
      }
      setTonePracticeSessionIds(scoped);
    } catch {
      // ignore malformed cache
    }
  }, [journey]);

  const pathNodes = useMemo((): JourneyPathNode[] => {
    const sorted = [...apiNodes].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const firstIncompleteId = sorted.find((n) => !n.completed_at)?.id;
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
      };
    });
  }, [apiNodes]);

  const currentNode = pathNodes.find((n) => n.current) ?? null;

  const saveCheckpointStoryId = useCallback((nodeId: string, storyId: string) => {
    if (!journey) return;
    setCheckpointStoryIds((prev) => ({ ...prev, [nodeId]: storyId }));
    try {
      const raw = window.localStorage.getItem(STORY_CACHE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      parsed[`${journey.id}:${nodeId}`] = storyId;
      window.localStorage.setItem(STORY_CACHE_KEY, JSON.stringify(parsed));
    } catch {
      // ignore write errors
    }
  }, [journey]);

  const resolveCheckpointStoryId = useCallback(async (node: JourneyPathNode, quiet = false): Promise<string | null> => {
    if (!journey || node.type !== "story") return null;
    const cached = node.storyId ?? checkpointStoryIds[node.id];
    if (cached) return cached;
    const pending = storyRequestRef.current[node.id];
    if (pending) return pending;
    const request = (async () => {
      const res = await fetch(`/api/journey/${journey.id}/story-checkpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyNodeId: node.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.storyId) {
        saveCheckpointStoryId(node.id, data.storyId);
        return data.storyId as string;
      }
      if (!quiet) {
        setStoryClickError(toJourneyUserError(data?.error, "Couldn't open story checkpoint yet."));
      } else {
        console.warn("[journey] story prefetch", data?.error);
      }
      return null;
    })();
    storyRequestRef.current[node.id] = request;
    try { return await request; }
    finally { delete storyRequestRef.current[node.id]; }
  }, [journey, checkpointStoryIds, saveCheckpointStoryId]);

  const saveTonePracticeSessionId = useCallback((nodeId: string, sessionId: string) => {
    if (!journey) return;
    setTonePracticeSessionIds((prev) => ({ ...prev, [nodeId]: sessionId }));
    try {
      const raw = window.localStorage.getItem(TONE_PRACTICE_CACHE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      parsed[`${journey.id}:${nodeId}`] = sessionId;
      window.localStorage.setItem(TONE_PRACTICE_CACHE_KEY, JSON.stringify(parsed));
    } catch {
      // ignore write errors
    }
  }, [journey]);

  const resolveTonePracticeSessionId = useCallback(async (node: JourneyPathNode, quiet = false): Promise<string | null> => {
    if (!journey || node.type !== "tone_practice") return null;
    const cached = node.pronunciationSessionId ?? tonePracticeSessionIds[node.id];
    if (cached) return cached;
    const pending = tonePracticeRequestRef.current[node.id];
    if (pending) return pending;
    const request = (async () => {
      const res = await fetch(`/api/journey/${journey.id}/tone-practice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyNodeId: node.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.sessionId) {
        saveTonePracticeSessionId(node.id, data.sessionId);
        return data.sessionId as string;
      }
      if (!quiet) {
        setStoryClickError(toJourneyUserError(data?.error, "Couldn't start pronunciation practice yet."));
      } else {
        console.warn("[journey] tone prefetch", data?.error);
      }
      return null;
    })();
    tonePracticeRequestRef.current[node.id] = request;
    try { return await request; }
    finally { delete tonePracticeRequestRef.current[node.id]; }
  }, [journey, tonePracticeSessionIds, saveTonePracticeSessionId]);

  const handleStoryOpen = useCallback((node: JourneyPathNode) => {
    if (!journey || node.type !== "story") return;
    setStoryClickError(null);
    const cached = node.storyId ?? checkpointStoryIds[node.id];
    if (cached) {
      router.push(`${appBase}/journey/${journey.id}/story/${cached}?journeyNodeId=${encodeURIComponent(node.id)}`);
      return;
    }
    router.push(`${appBase}/journey/${journey.id}/story-loading?journeyNodeId=${encodeURIComponent(node.id)}`);
  }, [journey, checkpointStoryIds, router, appBase]);

  const handleTonePracticeOpen = useCallback(async (node: JourneyPathNode) => {
    if (!journey || node.type !== "tone_practice") return;
    setStoryClickError(null);
    const sessionId = await resolveTonePracticeSessionId(node);
    if (sessionId) {
      router.push(
        `/app/pronunciation/session/${sessionId}?journeyId=${encodeURIComponent(journey.id)}&journeyNodeId=${encodeURIComponent(node.id)}`,
      );
    }
  }, [journey, resolveTonePracticeSessionId, router]);

  const handleNavigate = useCallback(async (node: JourneyPathNode) => {
    if (!journey) return;
    setStoryClickError(null);
    if (node.type === "story") {
      handleStoryOpen(node);
      return;
    }
    if (node.type === "tone_practice") {
      await handleTonePracticeOpen(node);
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
    const res = await fetch(`/api/journey/${journey.id}/start-island`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: node.islandOrder }),
    });
    const data = await res.json();
    if (data.islandId) {
      router.push(
        node.current
          ? `${appBase}/topic-islands/${data.islandId}/learn/preparing?journeyFirst=1`
          : `${appBase}/topic-islands/${data.islandId}?journeyFirst=1`,
      );
    }
  }, [journey, handleStoryOpen, handleTonePracticeOpen, router, appBase]);

  useEffect(() => {
    if (!journey || !currentNode || currentNode.type !== "story") return;
    void resolveCheckpointStoryId(currentNode, true).then((storyId) => {
      if (storyId) {
        router.prefetch(`/app/journey/${journey.id}/story/${storyId}?journeyNodeId=${encodeURIComponent(currentNode.id)}`);
      }
    });
  }, [journey, currentNode, resolveCheckpointStoryId, router]);

  useEffect(() => {
    if (!journey || !currentNode || currentNode.type !== "tone_practice") return;
    void resolveTonePracticeSessionId(currentNode, true).then((sessionId) => {
      if (sessionId) {
        router.prefetch(`/app/pronunciation/session/${sessionId}?journeyId=${encodeURIComponent(journey.id)}&journeyNodeId=${encodeURIComponent(currentNode.id)}`);
      }
    });
  }, [journey, currentNode, resolveTonePracticeSessionId, router]);

  if (loading) {
    return <AppPageLoading />;
  }

  if (!journey) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <p className="mb-4 text-4xl">🗺️</p>
          <p className="text-(--lingo-text-muted)">{t("Journey not found.")}</p>
          <button
            type="button"
            onClick={() => router.push("/app/journey/past")}
            className="mt-4 rounded-2xl bg-(--lingo-navy) px-5 py-2.5 text-sm font-bold text-white"
          >
            {t("Back to My Journeys")}
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = !!journey.completed_at;
  const isCurriculumUnit = !!journey.curriculum_unit_id;

  return (
    <JourneyDashboard
      title={journey.topic}
      why={journey.why}
      completedAt={journey.completed_at}
      eyebrow={t("Learning Path")}
      pathNodes={pathNodes}
      onNodeActivate={(node) => void handleNavigate(node)}
      clickError={storyClickError}
      backLink={{
        label: isCurriculumUnit ? t("My HSK Path") : t("My Journeys"),
        onClick: () =>
          router.push(isCurriculumUnit ? `${appBase}/journey` : "/app/journey/past"),
      }}
      extraHeader={
        isCompleted && journey.completed_at ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700">
            <CheckCircle2 size={12} />
            {t("Completed")} {formatDate(journey.completed_at)}
          </p>
        ) : null
      }
      headerActions={
        !isCurriculumUnit ? (
          <button
            type="button"
            onClick={() => router.push("/app/journey/create")}
            className="inline-flex items-center justify-center rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-(--lingo-navy) shadow-xs transition-colors hover:bg-(--lingo-sky-pale)"
            style={{ borderColor: "var(--lingo-border)" }}
          >
            {t("New Journey")}
          </button>
        ) : null
      }
    />
  );
}
