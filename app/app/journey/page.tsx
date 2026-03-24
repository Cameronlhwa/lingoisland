"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Lock, Map, Plus } from "lucide-react";

// ─── API shape ────────────────────────────────────────────────────────────────
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

// ─── View model ───────────────────────────────────────────────────────────────
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
  completed: boolean;
  current: boolean;
  paywalled: boolean;
};

// Zigzag alignment for island nodes by their index in the full node array
const ZIGZAG: Record<number, "left" | "center" | "right"> = {
  0: "left",
  1: "center",
  2: "right",
  3: "center",
  4: "left",
  5: "center",
  6: "right",
};

function justify(align: "left" | "center" | "right") {
  return align === "left"
    ? "justify-start"
    : align === "right"
      ? "justify-end"
      : "justify-center";
}

// ─── Island node — three visual states ───────────────────────────────────────

function CurrentIslandNode({
  node,
  align,
  onStart,
}: {
  node: PathNode;
  align: "left" | "center" | "right";
  onStart: () => void;
}) {
  return (
    <div className={`flex ${justify(align)}`}>
      <div className="w-64 lg:w-72 rounded-2xl bg-gray-900 px-5 py-4 shadow-lg shadow-gray-200/80 text-white">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/10 text-2xl">
            🏝
          </div>
          <div className="min-w-0">
            <p className="mb-0.5 text-[10px] font-bold uppercase leading-none tracking-widest text-gray-400">
              Island {node.islandOrder}
            </p>
            <p className="text-sm font-bold leading-tight text-white">
              {node.name}
            </p>
            {node.nameZh && (
              <p className="mt-0.5 text-xs text-gray-400">{node.nameZh}</p>
            )}
          </div>
        </div>
        <div className="mb-3 flex gap-2">
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-gray-300">
            {node.wordCount} words
          </span>
        </div>
        {node.paywalled ? (
          <div className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-white/10 py-2.5 text-xs font-black text-gray-400">
            <Lock size={11} /> Unlock with Pro
          </div>
        ) : (
          <button
            onClick={onStart}
            className="w-full rounded-xl bg-white py-2.5 text-xs font-black text-gray-900 transition-colors hover:bg-gray-100"
          >
            {node.islandId ? "Continue →" : "Start →"}
          </button>
        )}
      </div>
    </div>
  );
}

function CompletedIslandNode({
  node,
  align,
}: {
  node: PathNode;
  align: "left" | "center" | "right";
}) {
  return (
    <div className={`flex ${justify(align)}`}>
      <div className="flex w-52 lg:w-60 items-center gap-3 rounded-2xl border-2 border-teal-200 bg-teal-50 px-4 py-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-teal-500 text-lg">
          🏝
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold leading-tight text-teal-700">
            {node.name}
          </p>
          <p className="mt-0.5 text-[10px] text-teal-500">
            {node.wordCount} words · Done ✓
          </p>
        </div>
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-teal-500">
          <Check size={11} strokeWidth={3} className="text-white" />
        </div>
      </div>
    </div>
  );
}

function LockedIslandNode({
  node,
  align,
}: {
  node: PathNode;
  align: "left" | "center" | "right";
}) {
  return (
    <div className={`flex ${justify(align)}`}>
      <div className="flex w-52 lg:w-60 items-center gap-3 rounded-2xl border-2 border-gray-100 bg-gray-50 px-4 py-3 opacity-55">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gray-200 text-lg grayscale">
          🏝
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold leading-tight text-gray-400">
            {node.name}
          </p>
          <p className="mt-0.5 text-[10px] text-gray-300">
            {node.wordCount} words
          </p>
        </div>
        <Lock size={13} className="flex-shrink-0 text-gray-300" />
      </div>
    </div>
  );
}

function IslandNode({
  node,
  align,
  journeyId,
  router,
}: {
  node: PathNode;
  align: "left" | "center" | "right";
  journeyId: string;
  router: ReturnType<typeof useRouter>;
}) {
  const handleStart = async () => {
    if (node.islandId) {
      router.push(`/app/topic-islands/${node.islandId}?journeyFirst=1`);
      return;
    }
    const res = await fetch(`/api/journey/${journeyId}/start-island`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: node.islandOrder }),
    });
    const data = await res.json();
    if (data.islandId)
      router.push(`/app/topic-islands/${data.islandId}?journeyFirst=1`);
  };

  if (node.completed) return <CompletedIslandNode node={node} align={align} />;
  if (node.current)
    return <CurrentIslandNode node={node} align={align} onStart={handleStart} />;
  return <LockedIslandNode node={node} align={align} />;
}

// ─── Story checkpoint node ────────────────────────────────────────────────────

function StoryCheckpointNode({ node }: { node: PathNode }) {
  const isLocked = !node.completed && !node.current;
  return (
    <div className="flex justify-center py-1">
      <div
        className={`w-80 lg:w-96 rounded-2xl border-2 px-5 py-4 transition-all ${
          node.completed
            ? "border-amber-300 bg-amber-50"
            : node.current
              ? "border-amber-400 bg-amber-50 shadow-md shadow-amber-100"
              : "border-amber-100 bg-amber-50/50 opacity-60"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl ${
              node.completed || node.current ? "bg-amber-400" : "bg-amber-100"
            }`}
          >
            📖
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 text-[10px] font-black uppercase tracking-widest text-amber-500">
              Story Checkpoint
            </p>
            <p className="text-sm font-bold leading-tight text-gray-700">
              {node.name}
            </p>
            {node.hint && (
              <p className="mt-0.5 text-[10px] text-amber-600">{node.hint}</p>
            )}
          </div>
          {node.completed && (
            <Check size={15} strokeWidth={3} className="flex-shrink-0 text-amber-500" />
          )}
          {node.current && (
            <button
              disabled
              className="flex-shrink-0 rounded-xl bg-amber-200 px-3 py-2 text-xs font-black text-amber-400"
            >
              Soon
            </button>
          )}
          {isLocked && (
            <Lock size={13} className="flex-shrink-0 text-amber-200" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Desktop sidebar ──────────────────────────────────────────────────────────

function DesktopSidebar({
  journey,
  islands,
  islandsDone,
  totalWords,
  learnedWords,
  currentNode,
  router,
  journeyId,
}: {
  journey: { topic: string };
  islands: PathNode[];
  islandsDone: number;
  totalWords: number;
  learnedWords: number;
  currentNode: PathNode | null;
  router: ReturnType<typeof useRouter>;
  journeyId: string;
}) {
  const progressPct =
    islands.length > 0 ? (islandsDone / islands.length) * 100 : 0;

  const handleCurrentAction = async () => {
    if (!currentNode || currentNode.type !== "island") return;
    if (currentNode.islandId) {
      router.push(`/app/topic-islands/${currentNode.islandId}?journeyFirst=1`);
      return;
    }
    const res = await fetch(`/api/journey/${journeyId}/start-island`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: currentNode.islandOrder }),
    });
    const data = await res.json();
    if (data.islandId)
      router.push(`/app/topic-islands/${data.islandId}?journeyFirst=1`);
  };

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-8 space-y-4">
        {/* Journey title */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <Map size={14} className="text-gray-400" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Your Journey
            </span>
          </div>
          <h2 className="text-lg font-black leading-tight text-gray-900">
            {journey.topic}
          </h2>
        </div>

        {/* Progress */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">
            Progress
          </p>
          <div className="mb-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-teal-500 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-gray-400">
            <span>{islandsDone} / {islands.length} islands</span>
            <span>{learnedWords} / {totalWords} words</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-teal-50 px-3 py-2.5 text-center">
              <p className="text-lg font-black text-teal-600">{islandsDone}</p>
              <p className="text-[10px] text-teal-500">done</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-2.5 text-center">
              <p className="text-lg font-black text-gray-700">
                {islands.length - islandsDone}
              </p>
              <p className="text-[10px] text-gray-400">remaining</p>
            </div>
          </div>
        </div>

        {/* Up next */}
        {currentNode && (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">
              Up Next
            </p>
            {currentNode.type === "story" ? (
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-lg">
                  📖
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
                    Story Checkpoint
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-gray-900">
                    {currentNode.name}
                  </p>
                  {currentNode.hint && (
                    <p className="mt-1 text-[11px] text-gray-400">
                      {currentNode.hint}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-amber-500">
                    <BookOpen size={11} />
                    Coming soon
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-900 text-lg">
                  🏝
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Island {currentNode.islandOrder}
                  </p>
                  <p className="mt-0.5 text-sm font-bold leading-tight text-gray-900">
                    {currentNode.name}
                  </p>
                  {currentNode.nameZh && (
                    <p className="mt-0.5 text-xs text-gray-400">
                      {currentNode.nameZh}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-gray-400">
                    {currentNode.wordCount} words
                  </p>
                </div>
              </div>
            )}
            {currentNode.type === "island" && !currentNode.paywalled && (
              <button
                onClick={handleCurrentAction}
                className="mt-4 w-full rounded-xl bg-gray-900 py-2.5 text-xs font-black text-white transition-colors hover:bg-gray-700"
              >
                {currentNode.islandId ? "Continue →" : "Start →"}
              </button>
            )}
            {currentNode.paywalled && (
              <div className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-gray-100 py-2.5 text-xs font-bold text-gray-400">
                <Lock size={11} /> Unlock with Pro
              </div>
            )}
          </div>
        )}

        {/* Journey summary */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-gray-400">
            Journey
          </p>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-center justify-between">
              <span>Islands</span>
              <span className="font-bold text-gray-900">{islands.length}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Story checkpoints</span>
              <span className="font-bold text-gray-900">2</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Total words</span>
              <span className="font-bold text-gray-900">{totalWords}</span>
            </li>
          </ul>
        </div>

        {/* New Journey */}
        <button
          type="button"
          onClick={() => router.push("/app/journey/create")}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-3 text-xs font-semibold text-gray-500 transition-colors hover:bg-gray-50"
        >
          <Plus size={12} />
          New Journey
        </button>
      </div>
    </aside>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function JourneyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [journey, setJourney] = useState<{
    id: string;
    topic: string;
    words_per_week: number | null;
  } | null>(null);
  const [apiNodes, setApiNodes] = useState<ApiNode[]>([]);
  const [isPro, setIsPro] = useState(false);

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

  const pathNodes = useMemo((): PathNode[] => {
    const sorted = [...apiNodes].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0),
    );
    const firstIncompleteId = sorted.find((n) => !n.completed_at)?.id;
    return sorted.map((n) => {
      const islandOrder = n.order && n.order <= 10 ? n.order : n.position;
      return {
        id: n.id,
        type: n.node_type,
        position: n.position ?? 0,
        islandOrder,
        name: n.name,
        nameZh: n.zh ?? undefined,
        hint: n.hint ?? undefined,
        wordCount: n.word_count ?? (islandOrder === 1 ? 5 : 10),
        islandId: n.island_id ?? undefined,
        completed: !!n.completed_at,
        current: n.id === firstIncompleteId,
        paywalled: n.node_type === "island" && !isPro && islandOrder > 2,
      };
    });
  }, [apiNodes, isPro]);

  const islands = pathNodes.filter((n) => n.type === "island");
  const islandsDone = islands.filter((n) => n.completed).length;
  const totalWords = islands.reduce((s, n) => s + n.wordCount, 0);
  const learnedWords = islands
    .filter((n) => n.completed)
    .reduce((s, n) => s + n.wordCount, 0);
  const progressPct =
    islands.length > 0 ? (islandsDone / islands.length) * 100 : 0;
  const currentNode = pathNodes.find((n) => n.current) ?? null;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-gray-400">
        Loading…
      </div>
    );
  }

  if (!journey) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-[520px] text-center">
        <p className="mb-4 text-5xl">🗺️</p>
        <h2 className="text-xl font-black text-gray-900">
          Start your first Journey
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-gray-400">
          Pick a topic. Get a personalised 5-island path with stories woven in
          to lock in the words.
        </p>
        <button
          type="button"
          onClick={() => router.push("/app/journey/create")}
          className="mt-6 rounded-xl bg-gray-900 px-7 py-3 text-sm font-black text-white transition-colors hover:bg-gray-700"
        >
          Create a Journey →
        </button>
      </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── Desktop: two-column / Mobile: single column ── */}
      <div className="mx-auto max-w-5xl px-6 py-8 lg:grid lg:grid-cols-[1fr_280px] lg:items-start lg:gap-10 lg:px-10 lg:py-10">

        {/* ── Main path column ── */}
        <div className="max-w-[520px] lg:max-w-none">

          {/* Header — mobile only (desktop has sidebar) */}
          <div className="mb-2 flex items-start justify-between lg:hidden">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-gray-900">
                {journey.topic}
              </h1>
              <p className="mt-0.5 text-sm text-gray-400">
                {learnedWords} / {totalWords} words learned
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/app/journey/create")}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50"
            >
              <Plus size={12} /> New Journey
            </button>
          </div>

          {/* Progress bar — mobile only */}
          <div className="mb-8 mt-4 lg:hidden">
            <div className="h-2 rounded-full bg-gray-100">
              <div
                className="h-2 rounded-full bg-teal-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-1.5 flex justify-between">
              <span className="text-[10px] text-gray-400">
                {islandsDone} of {islands.length} islands complete
              </span>
              <span className="text-[10px] text-gray-400">
                {learnedWords} / {totalWords} words
              </span>
            </div>
          </div>

          {/* Desktop path header */}
          <div className="mb-8 hidden items-center justify-between lg:flex">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
                Learning path
              </p>
              <h1 className="mt-1 text-3xl font-black tracking-tight text-gray-900">
                {journey.topic}
              </h1>
            </div>
          </div>

          {/* Staggered path */}
          <div className="relative">
            {/* Connector line */}
            <div className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-gray-100 lg:w-0.5" />

            <div className="relative space-y-3 lg:space-y-4">
              {pathNodes.map((node, i) => {
                if (node.type === "story") {
                  return <StoryCheckpointNode key={node.id} node={node} />;
                }
                const align = ZIGZAG[i] ?? "center";
                return (
                  <IslandNode
                    key={node.id}
                    node={node}
                    align={align}
                    journeyId={journey.id}
                    router={router}
                  />
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-10">
            <div className="rounded-2xl border-2 border-dashed border-gray-200 p-5 text-center transition-colors hover:border-gray-300">
              <p className="text-sm font-semibold text-gray-400">
                Finish this journey to unlock the next
              </p>
              <p className="mt-1 text-xs text-gray-300">
                More topics coming soon
              </p>
            </div>
          </div>
        </div>

        {/* ── Desktop sidebar ── */}
        <DesktopSidebar
          journey={journey}
          islands={islands}
          islandsDone={islandsDone}
          totalWords={totalWords}
          learnedWords={learnedWords}
          currentNode={currentNode}
          router={router}
          journeyId={journey.id}
        />
      </div>
    </div>
  );
}
