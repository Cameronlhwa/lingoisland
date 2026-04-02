"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  Lock,
  Map,
} from "lucide-react";
import { useElementWidth } from "@/hooks/useElementWidth";
// ─── Map layout constants (must match /app/journey exactly) ───────────────────

const BASE_W = 380;
const MAP_TOP_PADDING = 64;
const MAP_BOTTOM_PADDING = 92;
const MAP_H = 820 + MAP_TOP_PADDING + MAP_BOTTOM_PADDING;
const MAX_W = 600;
const STORY_CACHE_KEY = "journey_story_checkpoint_cache_v1";

const BASE_NODES = [
  { bx: 100, cy: 55 },
  { bx: 280, cy: 175 },
  { bx: 190, cy: 295 },
  { bx: 80, cy: 415 },
  { bx: 270, cy: 530 },
  { bx: 155, cy: 645 },
  { bx: 190, cy: 760 },
] as const;

const MAP_NODES = BASE_NODES.map((n) => ({ bx: n.bx, cy: n.cy + MAP_TOP_PADDING }));

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiNode = {
  id: string;
  node_type: "island" | "story";
  position: number;
  order?: number;
  name: string;
  zh?: string | null;
  hint?: string | null;
  word_count?: number | null;
  island_id?: string | null;
  story_id?: string | null;
  completed_at?: string | null;
};

type PathNode = {
  id: string;
  type: "island" | "story";
  position: number;
  islandOrder: number;
  name: string;
  nameZh?: string;
  hint?: string;
  wordCount: number;
  islandId?: string;
  storyId?: string;
  completed: boolean;
  current: boolean;
};

// ─── Utilities ────────────────────────────────────────────────────────────────

function buildPath(nodes: readonly { cx: number; cy: number }[]) {
  return nodes.reduce((path, node, i) => {
    if (i === 0) return `M ${node.cx} ${node.cy}`;
    const prev = nodes[i - 1];
    const dy = node.cy - prev.cy;
    return `${path} C ${prev.cx} ${prev.cy + dy * 0.45}, ${node.cx} ${node.cy - dy * 0.45}, ${node.cx} ${node.cy}`;
  }, "");
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Node visual components (identical to /app/journey) ──────────────────────

function Pill({ children, light = false, scale = 1 }: { children: string; light?: boolean; scale?: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 9999,
        padding: `${Math.round(2 * scale)}px ${Math.round(6 * scale)}px`,
        fontSize: Math.round(9 * scale),
        fontWeight: 700,
        color: light ? "#9ca3af" : "#e5e7eb",
        background: light ? "#f9fafb" : "rgba(255,255,255,0.12)",
        border: `1px solid ${light ? "#f3f4f6" : "rgba(255,255,255,0.08)"}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function StoryNode({ size, done, current = false }: { size: number; done: boolean; current?: boolean }) {
  return (
    <div
      style={{
        width: current ? size + 10 : size,
        height: current ? size + 10 : size,
        borderRadius: Math.round(size * 0.3),
        background: current ? "#fff7ed" : "white",
        border: `2px solid ${current ? "#f59e0b" : done ? "#fbbf24" : "#fde68a"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: current ? "0 0 0 6px rgba(255,247,237,0.95), 0 10px 28px rgba(245,158,11,0.28)" : "none",
        transform: current ? "scale(1.06)" : "none",
        transition: "transform 180ms ease, box-shadow 180ms ease",
      }}
    >
      <BookOpen
        size={Math.max(15, Math.round(size * 0.38))}
        color={current ? "#ea580c" : done ? "#f59e0b" : "#fcd34d"}
      />
    </div>
  );
}

function DoneNode({ r }: { r: number }) {
  return (
    <div style={{ width: r * 2, height: r * 2, borderRadius: 9999, background: "#14b8a6", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
      <Check size={Math.max(16, Math.round(r * 0.75))} strokeWidth={3} />
    </div>
  );
}

function CurrentNode({ r, num, fontSize }: { r: number; num: number; fontSize: number }) {
  return (
    <div style={{ width: r * 2, height: r * 2, borderRadius: 9999, background: "#111827", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize, fontWeight: 900, boxShadow: "0 0 0 6px #f3f4f6, 0 4px 20px rgba(0,0,0,0.25)" }}>
      {num}
    </div>
  );
}

function LockedNode({ r, num, fontSize }: { r: number; num: number; fontSize: number }) {
  return (
    <div style={{ width: r * 2, height: r * 2, borderRadius: 9999, border: "2px solid #e5e7eb", background: "white", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize, fontWeight: 900 }}>
      {num}
    </div>
  );
}

function LabelCard({
  node,
  isStory,
  isDesktop,
  onNavigate,
  scale = 1,
}: {
  node: PathNode;
  isStory: boolean;
  isDesktop: boolean;
  onNavigate: (node: PathNode) => void;
  scale?: number;
}) {
  const padY = Math.round((isDesktop ? 12 : 10) * scale);
  const padX = Math.round((isDesktop ? 14 : 12) * scale);
  const titleSz = Math.round((isDesktop ? 14 : 12) * scale);
  const bodySz = Math.round((isDesktop ? 10 : 9) * scale);
  const eyebrowSz = Math.round(9 * scale);
  const compactSz = Math.round(11 * scale);

  if (isStory && node.current) {
    return (
      <div style={{ background: "linear-gradient(135deg,#fff7ed 0%,#fffbeb 100%)", border: "1px solid #fdba74", borderRadius: 14, padding: `${Math.round((isDesktop ? 10 : 9) * scale)}px ${Math.round((isDesktop ? 12 : 10) * scale)}px`, boxShadow: "0 10px 28px rgba(245,158,11,0.18)" }}>
        <p style={{ fontSize: eyebrowSz, fontWeight: 900, color: "#ea580c", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.1em" }}>Story checkpoint</p>
        <p style={{ fontSize: titleSz, fontWeight: 900, color: "#7c2d12", lineHeight: 1.3 }}>{node.name}</p>
        <p style={{ fontSize: bodySz, color: "#c2410c", marginTop: 4, fontWeight: 700 }}>Open now →</p>
      </div>
    );
  }

  if (isStory) {
    return (
      <div style={{ background: node.completed ? "#fffbeb" : "rgba(255,251,235,0.9)", border: `1px solid ${node.completed ? "#fde68a" : "#fef3c7"}`, borderRadius: 12, padding: `${Math.round(8 * scale)}px ${Math.round(10 * scale)}px`, opacity: node.completed ? 1 : 0.8, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <p style={{ fontSize: eyebrowSz, fontWeight: 900, color: "#f59e0b", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.1em" }}>Story</p>
        <p style={{ fontSize: compactSz, fontWeight: 700, color: "#374151", lineHeight: 1.3 }}>{node.name}</p>
        {isDesktop && <p style={{ fontSize: bodySz, color: "#d97706", marginTop: 3 }}>{node.completed ? "Read again →" : "Vocab checkpoint"}</p>}
      </div>
    );
  }

  if (node.current) {
    return (
      <div style={{ background: "#111827", borderRadius: 14, padding: `${padY}px ${padX}px`, boxShadow: "0 6px 24px rgba(0,0,0,0.22)" }}>
        <p style={{ fontSize: eyebrowSz, fontWeight: 900, color: "#9ca3af", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.1em" }}>Up next</p>
        <p style={{ fontSize: titleSz, fontWeight: 900, color: "white", lineHeight: 1.3, marginBottom: isDesktop ? 4 : 8 }}>{node.name}</p>
        {isDesktop && node.nameZh && <p style={{ fontSize: bodySz, color: "#9ca3af", marginBottom: 7 }}>{node.nameZh}</p>}
        {isDesktop && <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}><Pill scale={scale}>{`${node.wordCount} words`}</Pill></div>}
        <button
          type="button"
          onClick={() => void onNavigate(node)}
          style={{ width: "100%", background: "white", color: "#111827", fontSize: Math.round(10 * scale), fontWeight: 900, padding: `${Math.round(6 * scale)}px 0`, borderRadius: 8, border: "none", cursor: "pointer" }}
        >
          Continue →
        </button>
      </div>
    );
  }

  if (node.completed) {
    return (
      <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 12, padding: `${Math.round((isDesktop ? 10 : 8) * scale)}px ${Math.round((isDesktop ? 12 : 10) * scale)}px`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <p style={{ fontSize: titleSz, fontWeight: 700, color: "#0f766e", lineHeight: 1.3 }}>{node.name}</p>
        <p style={{ fontSize: bodySz, color: "#5eead4", marginTop: 2 }}>Review →</p>
      </div>
    );
  }

  return (
    <div style={{ background: "white", border: "1px solid #f3f4f6", borderRadius: 12, padding: `${Math.round((isDesktop ? 10 : 8) * scale)}px ${Math.round((isDesktop ? 12 : 10) * scale)}px`, opacity: 0.6, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <p style={{ fontSize: compactSz, fontWeight: 700, color: "#9ca3af", lineHeight: 1.3, marginBottom: isDesktop ? 5 : 0 }}>{node.name}</p>
      {isDesktop && <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}><Pill light scale={scale}>{`${node.wordCount} words`}</Pill></div>}
    </div>
  );
}

function JourneyMapNode({
  node,
  baseNode,
  showDesktopDetails,
  showLabel,
  onNavigate,
  scale = 1,
}: {
  node: PathNode;
  baseNode: { bx: number; cy: number };
  showDesktopDetails: boolean;
  showLabel: boolean;
  onNavigate: (node: PathNode) => void;
  scale?: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const isStory = node.type === "story";
  const storyClickable = isStory && (node.current || node.completed);
  const islandClickable = node.completed || node.current;
  const hoverScale = (node.completed || node.current) && isHovered ? 1.08 : 1;
  const onLeft = baseNode.bx < BASE_W / 2;
  const storySize = Math.round(40 * scale);
  const islandSize = Math.round((node.current ? 52 : 44) * scale);
  const islandRadius = Math.round((node.current ? 26 : 22) * scale);
  const iconHalf = isStory ? storySize / 2 : islandSize / 2;
  const pctX = `${(baseNode.bx / BASE_W) * 100}%`;
  const labelWidth = Math.round(148 * scale);
  const labelOffset = iconHalf + 10;

  const handleClick = () => {
    if (isStory) { if (storyClickable) void onNavigate(node); }
    else { if (islandClickable) void onNavigate(node); }
  };

  const iconButton = (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex", border: "none", background: "transparent", padding: 0,
        cursor: (isStory ? storyClickable : islandClickable) ? "pointer" : "default",
        pointerEvents: (isStory ? storyClickable : islandClickable) ? "auto" : "none",
        position: "relative", zIndex: 1,
        transform: `scale(${hoverScale})`,
        transition: "transform 220ms cubic-bezier(0.22,1,0.36,1)",
        willChange: "transform",
      }}
      disabled={!(isStory ? storyClickable : islandClickable)}
    >
      {isStory ? (
        <StoryNode size={storySize} done={node.completed} current={node.current} />
      ) : node.completed ? (
        <DoneNode r={islandRadius} />
      ) : node.current ? (
        <CurrentNode r={islandRadius} num={node.islandOrder} fontSize={Math.round(16 * scale)} />
      ) : (
        <LockedNode r={islandRadius} num={node.islandOrder} fontSize={Math.round(14 * scale)} />
      )}
    </button>
  );

  const labelClickable = isStory ? storyClickable : islandClickable;
  const labelEl = (
    <LabelCard node={node} isStory={isStory} isDesktop={showDesktopDetails} onNavigate={onNavigate} scale={scale} />
  );

  return (
    <div
      style={{
        position: "absolute", left: pctX, top: baseNode.cy,
        transform: "translate(-50%,-50%)",
        zIndex: node.current ? 60 : node.completed ? 30 : 10,
      }}
    >
      {iconButton}

      {showLabel && (
        labelClickable ? (
          <button
            type="button"
            onClick={handleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
              position: "absolute", top: "50%",
              transform: `translateY(-50%) scale(${hoverScale})`,
              ...(onLeft ? { left: labelOffset } : { right: labelOffset }),
              width: labelWidth, border: "none", background: "transparent", padding: 0,
              textAlign: "left", cursor: "pointer",
              zIndex: node.current ? 90 : 40,
              transition: "transform 220ms cubic-bezier(0.22,1,0.36,1)",
              willChange: "transform",
            }}
          >
            {labelEl}
          </button>
        ) : (
          <div
            style={{
              position: "absolute", top: "50%", transform: "translateY(-50%)",
              ...(onLeft ? { left: labelOffset } : { right: labelOffset }),
              width: labelWidth, pointerEvents: "none",
              zIndex: node.current ? 3 : 2,
            }}
          >
            {labelEl}
          </div>
        )
      )}
    </div>
  );
}

function StatBox({ value, label, tone }: { value: number; label: string; tone: "teal" | "gray" | "dark" }) {
  const cls = { teal: "bg-teal-50 text-teal-700", gray: "bg-gray-100 text-gray-500", dark: "bg-gray-900 text-white" }[tone];
  return (
    <div className={`flex-1 rounded-xl px-3 py-2 text-center ${cls}`}>
      <div className="text-sm font-black">{value}</div>
      <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.16em] opacity-80">{label}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JourneyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const journeyId = params?.id as string;
  const pageRef = useRef<HTMLDivElement | null>(null);
  const storyRequestRef = useRef<Record<string, Promise<string | null>>>({});

  const [loading, setLoading] = useState(true);
  const [journey, setJourney] = useState<{
    id: string;
    topic: string;
    completed_at: string | null;
    created_at: string;
  } | null>(null);
  const [apiNodes, setApiNodes] = useState<ApiNode[]>([]);
  const [storyClickError, setStoryClickError] = useState<string | null>(null);
  const [checkpointStoryIds, setCheckpointStoryIds] = useState<Record<string, string>>({});
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);

  const pageWidth = useElementWidth(pageRef, 920);
  const wide = isDesktopViewport && pageWidth > 560;
  const mapUiScale = pageWidth >= 560 ? Math.min(1.22, Math.max(1, pageWidth / 560)) : 1;
  const showMapLabels = pageWidth > 430;
  const showDesktopMapDetails = pageWidth > 960;

  // Load journey + nodes
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

  // Responsive viewport detection
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setIsDesktopViewport(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Story checkpoint ID cache (keyed by journeyId so multi-journey safe)
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

  const pathNodes = useMemo((): PathNode[] => {
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
        wordCount: node.word_count ?? (islandOrder === 1 ? 5 : 10),
        islandId: node.island_id ?? undefined,
        storyId: node.story_id ?? undefined,
        completed: !!node.completed_at,
        current: node.id === firstIncompleteId,
      };
    });
  }, [apiNodes]);

  const islands = pathNodes.filter((n) => n.type === "island");
  const islandsDone = islands.filter((n) => n.completed).length;
  const learnedWords = islands.filter((n) => n.completed).reduce((s, n) => s + n.wordCount, 0);
  const totalWords = islands.reduce((s, n) => s + n.wordCount, 0);
  const currentNode = pathNodes.find((n) => n.current) ?? null;
  const currentNodeIndex = pathNodes.findIndex((n) => n.current);
  const comingUp = pathNodes.filter((n) => !n.completed && !n.current).slice(0, 3);

  const pathD = buildPath(MAP_NODES.map((n) => ({ cx: n.bx, cy: n.cy })));
  const progressPathD = useMemo(() => {
    if (pathNodes.length === 0) return "";
    if (currentNodeIndex >= 0) {
      const pts = MAP_NODES.slice(0, currentNodeIndex + 1).map((n) => ({ cx: n.bx, cy: n.cy }));
      return pts.length > 1 ? buildPath(pts) : "";
    }
    return pathNodes.every((n) => n.completed) ? pathD : "";
  }, [currentNodeIndex, pathD, pathNodes]);

  // ── Story checkpoint resolution (same pattern as /app/journey) ─────────────

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

  const resolveCheckpointStoryId = useCallback(async (node: PathNode): Promise<string | null> => {
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
      setStoryClickError(typeof data?.error === "string" ? data.error : "Couldn't open story checkpoint yet.");
      return null;
    })();
    storyRequestRef.current[node.id] = request;
    try { return await request; }
    finally { delete storyRequestRef.current[node.id]; }
  }, [journey, checkpointStoryIds, saveCheckpointStoryId]);

  // ── Navigation handlers ───────────────────────────────────────────────────

  const handleStoryOpen = useCallback((node: PathNode) => {
    if (!journey || node.type !== "story") return;
    setStoryClickError(null);
    const cached = node.storyId ?? checkpointStoryIds[node.id];
    if (cached) {
      router.push(`/app/journey/${journey.id}/story/${cached}?journeyNodeId=${encodeURIComponent(node.id)}`);
      return;
    }
    router.push(`/app/journey/${journey.id}/story-loading?journeyNodeId=${encodeURIComponent(node.id)}`);
  }, [journey, checkpointStoryIds, router]);

  const handleNavigate = useCallback(async (node: PathNode) => {
    if (!journey) return;
    setStoryClickError(null);
    if (node.type === "story") {
      handleStoryOpen(node);
      return;
    }
    if (node.islandId) {
      router.push(`/app/topic-islands/${node.islandId}?journeyFirst=1`);
      return;
    }
    // Island not yet started — create it via start-island
    const res = await fetch(`/api/journey/${journey.id}/start-island`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: node.islandOrder }),
    });
    const data = await res.json();
    if (data.islandId) {
      router.push(`/app/topic-islands/${data.islandId}?journeyFirst=1`);
    }
  }, [journey, handleStoryOpen, router]);

  // Prefetch current story checkpoint on mount
  useEffect(() => {
    if (!journey || !currentNode || currentNode.type !== "story") return;
    void resolveCheckpointStoryId(currentNode).then((storyId) => {
      if (storyId) {
        router.prefetch(`/app/journey/${journey.id}/story/${storyId}?journeyNodeId=${encodeURIComponent(currentNode.id)}`);
      }
    });
  }, [journey, currentNode, resolveCheckpointStoryId, router]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-gray-400">Loading…</div>;
  }

  if (!journey) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <p className="mb-4 text-4xl">🗺️</p>
          <p className="text-gray-500">Journey not found.</p>
          <button
            type="button"
            onClick={() => router.push("/app/journey/past")}
            className="mt-4 rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-black text-white"
          >
            Back to My Journeys
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = !!journey.completed_at;
  const progressPct = islands.length > 0 ? (islandsDone / islands.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-white px-4 py-6 md:px-6 md:py-8 lg:px-10">
      <div className="mx-auto w-full max-w-[1380px]">

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.push("/app/journey/past")}
              className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-gray-400 transition-colors hover:text-gray-700"
            >
              <ArrowLeft size={13} />
              My Journeys
            </button>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
              {isCompleted ? "Completed Journey" : "In Progress"}
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-gray-900">{journey.topic}</h1>
            <p className="mt-1 text-sm text-gray-500">{learnedWords} / {totalWords} words learned</p>
          </div>
          <div className="flex items-center gap-2">
            {isCompleted && journey.completed_at && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-teal-600">
                <CheckCircle2 size={10} />
                Completed {formatDate(journey.completed_at)}
              </span>
            )}
            <button
              type="button"
              onClick={() => router.push("/app/journey/create")}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
            >
              New Journey
            </button>
          </div>
        </div>

        {/* Map + sidebar (same responsive layout as /app/journey) */}
        <div
          ref={pageRef}
          style={{ display: "flex", flexDirection: wide ? "row" : "column", gap: wide ? 32 : 24, width: "100%", alignItems: "flex-start" }}
        >
          {/* Map column */}
          <div style={{ flex: "1 1 760px", minWidth: 0, width: "100%" }}>
            <div
              className="relative w-full max-w-[600px] sm:rounded-3xl sm:bg-slate-50"
              style={{ position: "relative", width: "100%", maxWidth: MAX_W, height: MAP_H, margin: "0 auto" }}
            >
              <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
                <svg
                  viewBox={`0 0 ${BASE_W} ${MAP_H}`}
                  width="100%"
                  height={MAP_H}
                  preserveAspectRatio="none"
                  style={{ position: "absolute", inset: 0, display: "block", pointerEvents: "none" }}
                >
                  <path d={pathD} fill="none" stroke="#e2e8f0" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" pathLength={1000} style={{ vectorEffect: "non-scaling-stroke" }} />
                  <path d={pathD} fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeDasharray="12 16" pathLength={1000} style={{ vectorEffect: "non-scaling-stroke" }} />
                  <path d={progressPathD} fill="none" stroke="#14b8a6" strokeWidth={10} strokeLinecap="round" style={{ vectorEffect: "non-scaling-stroke" }} />
                </svg>

                {pathNodes.map((node, index) => (
                  <JourneyMapNode
                    key={node.id}
                    node={node}
                    baseNode={MAP_NODES[index] ?? MAP_NODES[0]}
                    showDesktopDetails={showDesktopMapDetails}
                    showLabel={showMapLabels}
                    onNavigate={handleNavigate}
                    scale={mapUiScale}
                  />
                ))}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 pb-3 text-center">
                  <p className="text-[11px] font-semibold text-slate-300">
                    {isCompleted ? "All islands completed ✓" : `${islandsDone} of ${islands.length} islands completed`}
                  </p>
                </div>
              </div>
            </div>

            {storyClickError && (
              <p className="mt-3 text-center text-xs font-semibold text-rose-500">{storyClickError}</p>
            )}

            {/* Mobile Up Next card */}
            {!wide && currentNode && (
              <div className="mt-4 rounded-2xl bg-gray-900 p-4">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Up Next</p>
                <p className="text-sm font-black text-white">{currentNode.name}</p>
                <p className="mb-3 mt-1 text-[11px] text-gray-400">
                  {currentNode.type === "story"
                    ? currentNode.hint ?? "Story checkpoint"
                    : `${currentNode.nameZh ?? "Mandarin vocab"} · ${currentNode.wordCount} words`}
                </p>
                {currentNode.type === "island" ? (
                  <button type="button" onClick={() => void handleNavigate(currentNode)} className="w-full rounded-xl bg-white py-2 text-xs font-black text-gray-900">
                    Continue →
                  </button>
                ) : (
                  <button type="button" onClick={() => handleStoryOpen(currentNode)} className="flex w-full items-center justify-center gap-1 rounded-xl bg-white py-2 text-xs font-black text-gray-900">
                    <BookOpen className="h-3 w-3" />
                    Story checkpoint
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Desktop sidebar */}
          {wide && (
            <div className="flex-shrink-0" style={{ width: 220 }}>
              <div className="space-y-4">

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="mb-2 flex items-center gap-2">
                    <Map className="h-4 w-4 text-gray-400" />
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Journey</p>
                  </div>
                  <h2 className="text-lg font-black leading-tight text-gray-900">{journey.topic}</h2>
                  {isCompleted && journey.completed_at && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-teal-600">
                      <CheckCircle2 size={10} />
                      Completed {formatDate(journey.completed_at)}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Progress</p>
                  <div className="mb-2 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-teal-500 transition-all duration-700" style={{ width: `${progressPct}%` }} />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <StatBox value={islandsDone} label="done" tone="teal" />
                    <StatBox value={Math.max(0, islands.length - islandsDone)} label="left" tone="gray" />
                    <StatBox value={learnedWords} label="words" tone="dark" />
                  </div>
                </div>

                {currentNode && (
                  <div className="rounded-2xl bg-gray-900 p-5 shadow-sm">
                    <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Up Next</p>
                    <p className="text-sm font-black text-white">{currentNode.name}</p>
                    <p className="mt-1 text-[11px] text-gray-400">
                      {currentNode.type === "story"
                        ? currentNode.hint ?? "Story checkpoint"
                        : `${currentNode.nameZh ?? "Mandarin vocab"} · ${currentNode.wordCount} words`}
                    </p>
                    {currentNode.type === "island" ? (
                      <button type="button" onClick={() => void handleNavigate(currentNode)} className="mt-4 w-full rounded-xl bg-white py-2.5 text-xs font-black text-gray-900 transition-colors hover:bg-gray-100">
                        Continue →
                      </button>
                    ) : (
                      <button type="button" onClick={() => handleStoryOpen(currentNode)} className="mt-4 flex w-full items-center justify-center gap-1 rounded-xl bg-white py-2.5 text-xs font-black text-gray-900 transition-colors hover:bg-gray-100">
                        <BookOpen className="h-3 w-3" />
                        Story checkpoint
                      </button>
                    )}
                  </div>
                )}

                {comingUp.length > 0 && (
                  <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Coming Up</p>
                    <div className="space-y-3">
                      {comingUp.map((node) => (
                        <div key={node.id} className="flex items-center gap-2.5">
                          <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                            {node.type === "story" ? <BookOpen size={10} color="#fbbf24" /> : <Lock size={9} color="#d1d5db" />}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium text-gray-500">{node.name}</p>
                            <p className={`mt-0.5 text-[9px] ${node.type === "story" ? "text-amber-300" : "text-gray-300"}`}>
                              {node.type === "story" ? "Story checkpoint" : `${node.wordCount} words`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Journey Stats</p>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center justify-between">
                      <span>Islands</span>
                      <span className="font-bold text-gray-900">{islands.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Total words</span>
                      <span className="font-bold text-gray-900">{totalWords}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Words learned</span>
                      <span className="font-bold text-gray-900">{learnedWords}</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
