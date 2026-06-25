"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Clock, Lock, Map, Plus } from "lucide-react";
import { useElementWidth } from "@/hooks/useElementWidth";
import { BrowsePreviousJourneys } from "@/components/app/BrowsePreviousJourneys";
import type { CompletedJourney } from "@/types/journey";

const BASE_W = 380;
const MAP_TOP_PADDING = 64;
const MAP_BOTTOM_PADDING = 92;
const MAP_H = 820 + MAP_TOP_PADDING + MAP_BOTTOM_PADDING;
const MAX_W = 600;
const BASE_NODES = [
  { bx: 100, cy: 55 },
  { bx: 280, cy: 175 },
  { bx: 190, cy: 295 },
  { bx: 80, cy: 415 },
  { bx: 270, cy: 530 },
  { bx: 155, cy: 645 },
  { bx: 190, cy: 760 },
] as const;
const MAP_NODES = BASE_NODES.map((node) => ({
  bx: node.bx,
  cy: node.cy + MAP_TOP_PADDING,
}));

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
  paywalled: boolean;
};

function buildPath(nodes: readonly { cx: number; cy: number }[]) {
  return nodes.reduce((path, node, index) => {
    if (index === 0) {
      return `M ${node.cx} ${node.cy}`;
    }
    const previous = nodes[index - 1];
    const dy = node.cy - previous.cy;
    return `${path} C ${previous.cx} ${previous.cy + dy * 0.45}, ${node.cx} ${
      node.cy - dy * 0.45
    }, ${node.cx} ${node.cy}`;
  }, "");
}

function Pill({
  children,
  light = false,
  scale = 1,
}: {
  children: string;
  light?: boolean;
  scale?: number;
}) {
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

function StoryNode({
  size,
  done,
  current = false,
}: {
  size: number;
  done: boolean;
  current?: boolean;
}) {
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
        opacity: 1,
        boxShadow: current
          ? "0 0 0 6px rgba(255,247,237,0.95), 0 10px 28px rgba(245,158,11,0.28)"
          : "none",
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
    <div
      style={{
        width: r * 2,
        height: r * 2,
        borderRadius: 9999,
        background: "#14b8a6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
      }}
    >
      <Check size={Math.max(16, Math.round(r * 0.75))} strokeWidth={3} />
    </div>
  );
}

function CurrentNode({
  r,
  num,
  fontSize,
}: {
  r: number;
  num: number;
  fontSize: number;
}) {
  return (
    <div
      style={{
        width: r * 2,
        height: r * 2,
        borderRadius: 9999,
        background: "#111827",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "white",
        fontSize,
        fontWeight: 900,
        boxShadow: "0 0 0 6px #f3f4f6, 0 4px 20px rgba(0,0,0,0.25)",
      }}
    >
      {num}
    </div>
  );
}

function LockedNode({
  r,
  num,
  fontSize,
}: {
  r: number;
  num: number;
  fontSize: number;
}) {
  return (
    <div
      style={{
        width: r * 2,
        height: r * 2,
        borderRadius: 9999,
        border: "2px solid #e5e7eb",
        background: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#9ca3af",
        fontSize,
        fontWeight: 900,
      }}
    >
      {num}
    </div>
  );
}

function LabelCard({
  node,
  isStory,
  isDesktop,
  onContinue,
  scale = 1,
}: {
  node: PathNode;
  isStory: boolean;
  isDesktop: boolean;
  onContinue: (node: PathNode) => void;
  scale?: number;
}) {
  const cardPadY = Math.round((isDesktop ? 12 : 10) * scale);
  const cardPadX = Math.round((isDesktop ? 14 : 12) * scale);
  const storyPadY = Math.round(8 * scale);
  const storyPadX = Math.round(10 * scale);
  const titleSize = Math.round((isDesktop ? 14 : 12) * scale);
  const bodySize = Math.round((isDesktop ? 10 : 9) * scale);
  const eyebrowSize = Math.round(9 * scale);
  const compactTitleSize = Math.round(11 * scale);

  if (isStory && node.current) {
    return (
      <div
        style={{
          background: "linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)",
          border: "1px solid #fdba74",
          borderRadius: 14,
          padding: `${Math.round((isDesktop ? 10 : 9) * scale)}px ${Math.round((isDesktop ? 12 : 10) * scale)}px`,
          boxShadow: "0 10px 28px rgba(245,158,11,0.18)",
        }}
      >
        <p
          style={{
            fontSize: eyebrowSize,
            fontWeight: 900,
            color: "#ea580c",
            marginBottom: 2,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Story checkpoint
        </p>
        <p style={{ fontSize: titleSize, fontWeight: 900, color: "#7c2d12", lineHeight: 1.3 }}>
          {node.name}
        </p>
        <p style={{ fontSize: bodySize, color: "#c2410c", marginTop: 4, fontWeight: 700 }}>
          Open now →
        </p>
      </div>
    );
  }

  if (isStory) {
    return (
      <div
        style={{
          background: node.completed ? "#fffbeb" : "rgba(255,251,235,0.9)",
          border: `1px solid ${node.completed ? "#fde68a" : "#fef3c7"}`,
          borderRadius: 12,
          padding: `${storyPadY}px ${storyPadX}px`,
          opacity: node.completed ? 1 : 0.8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <p
          style={{
            fontSize: eyebrowSize,
            fontWeight: 900,
            color: "#f59e0b",
            marginBottom: 2,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Story
        </p>
        <p style={{ fontSize: compactTitleSize, fontWeight: 700, color: "#374151", lineHeight: 1.3 }}>
          {node.name}
        </p>
        {isDesktop && (
          <p style={{ fontSize: bodySize, color: "#d97706", marginTop: 3 }}>
            Vocab checkpoint
          </p>
        )}
      </div>
    );
  }

  if (node.current) {
    return (
      <div
        style={{
          background: "#111827",
          borderRadius: 14,
          padding: `${cardPadY}px ${cardPadX}px`,
          boxShadow: "0 6px 24px rgba(0,0,0,0.22)",
        }}
      >
        <p
          style={{
            fontSize: eyebrowSize,
            fontWeight: 900,
            color: "#9ca3af",
            marginBottom: 2,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Up next
        </p>
        <p
          style={{
            fontSize: titleSize,
            fontWeight: 900,
            color: "white",
            lineHeight: 1.3,
            marginBottom: isDesktop ? 4 : 8,
          }}
        >
          {node.name}
        </p>
        {isDesktop && node.nameZh && (
          <p style={{ fontSize: bodySize, color: "#9ca3af", marginBottom: 7 }}>{node.nameZh}</p>
        )}
        {isDesktop && (
          <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
            <Pill scale={scale}>{`${node.wordCount} words`}</Pill>
            <Pill scale={scale}>{node.wordCount <= 5 ? "Bite-size" : "Core vocab"}</Pill>
            <Pill scale={scale}>{`~${node.wordCount} min`}</Pill>
          </div>
        )}
        <button
          type="button"
          onClick={() => void onContinue(node)}
          style={{
            width: "100%",
            background: "white",
            color: "#111827",
            fontSize: Math.round(10 * scale),
            fontWeight: 900,
            padding: `${Math.round(6 * scale)}px 0`,
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
          }}
        >
          Continue →
        </button>
      </div>
    );
  }

  if (node.completed) {
    return (
      <div
        style={{
          background: "#f0fdfa",
          border: "1px solid #99f6e4",
          borderRadius: 12,
          padding: `${Math.round((isDesktop ? 10 : 8) * scale)}px ${Math.round((isDesktop ? 12 : 10) * scale)}px`,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <p style={{ fontSize: titleSize, fontWeight: 700, color: "#0f766e", lineHeight: 1.3 }}>
          {node.name}
        </p>
        <p style={{ fontSize: bodySize, color: "#5eead4", marginTop: 2 }}>Done ✓</p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #f3f4f6",
        borderRadius: 12,
        padding: `${Math.round((isDesktop ? 10 : 8) * scale)}px ${Math.round((isDesktop ? 12 : 10) * scale)}px`,
        opacity: 0.6,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <p
        style={{
          fontSize: compactTitleSize,
          fontWeight: 700,
          color: "#9ca3af",
          lineHeight: 1.3,
          marginBottom: isDesktop ? 5 : 0,
        }}
      >
        {node.name}
      </p>
      {isDesktop ? (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <Pill light scale={scale}>{`${node.wordCount} words`}</Pill>
          <Pill light scale={scale}>{node.wordCount <= 5 ? "Starter" : "Core"}</Pill>
        </div>
      ) : (
        <p style={{ fontSize: bodySize, color: "#d1d5db", marginTop: 2 }}>
          {node.wordCount} words
        </p>
      )}
    </div>
  );
}

function JourneyMapNode({
  node,
  baseNode,
  showDesktopDetails,
  showLabel,
  onContinue,
  scale = 1,
}: {
  node: PathNode;
  baseNode: { bx: number; cy: number };
  showDesktopDetails: boolean;
  showLabel: boolean;
  onContinue: (node: PathNode) => void;
  scale?: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const isStory = node.type === "story";
  const storyClickable = isStory && (node.current || node.completed);
  const islandClickable = node.completed || node.current || node.paywalled;
  const hoverEligible = node.completed || node.current;
  const hoverScale = hoverEligible && isHovered ? 1.08 : 1;
  const onLeft = baseNode.bx < BASE_W / 2;
  const storySize = Math.round(40 * scale);
  const islandSize = Math.round((node.current ? 52 : 44) * scale);
  const islandRadius = Math.round((node.current ? 26 : 22) * scale);
  const iconHalf = isStory ? storySize / 2 : islandSize / 2;
  const pctX = `${(baseNode.bx / BASE_W) * 100}%`;
  const labelWidth = Math.round(148 * scale);
  const labelOffset = iconHalf + 10;

  const handleClick = () => {
    if (node.type === "story") {
      if (node.completed || node.current) {
        void onContinue(node);
      }
      return;
    }
    if (islandClickable) {
      void onContinue(node);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        left: pctX,
        top: baseNode.cy,
        transform: "translate(-50%, -50%)",
        zIndex: node.current ? 60 : node.completed ? 30 : 10,
        cursor: storyClickable ? "pointer" : undefined,
      }}
    >
      {isStory ? (
        <>
          <button
            type="button"
            onClick={() => {
              if (storyClickable) {
                void onContinue(node);
              }
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onKeyDown={(event) => {
              if (!storyClickable) return;
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void onContinue(node);
              }
            }}
            style={{
              display: "flex",
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: storyClickable ? "pointer" : "default",
              pointerEvents: storyClickable ? "auto" : "none",
              position: "relative",
              zIndex: 1,
              transform: `scale(${hoverScale})`,
              transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
              willChange: "transform",
            }}
            disabled={!storyClickable}
          >
            <StoryNode size={storySize} done={node.completed} current={node.current} />
          </button>
          {showLabel && (
            storyClickable ? (
              <button
                type="button"
                onClick={() => void onContinue(node)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{
                  position: "absolute",
                  top: "50%",
                  transform: `translateY(-50%) scale(${hoverScale})`,
                  ...(onLeft
                    ? { left: labelOffset }
                    : { right: labelOffset }),
                  width: labelWidth,
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  textAlign: "left",
                  cursor: "pointer",
                  pointerEvents: "auto",
                  zIndex: node.current ? 90 : 40,
                  transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                  willChange: "transform",
                }}
              >
                <LabelCard
                  node={node}
                  isStory
                  isDesktop={showDesktopDetails}
                  onContinue={onContinue}
                  scale={scale}
                />
              </button>
            ) : (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  transform: "translateY(-50%)",
                  ...(onLeft
                    ? { left: labelOffset }
                    : { right: labelOffset }),
                  width: labelWidth,
                  pointerEvents: "none",
                  zIndex: node.current ? 3 : 2,
                }}
              >
                <LabelCard
                  node={node}
                  isStory
                  isDesktop={showDesktopDetails}
                  onContinue={onContinue}
                  scale={scale}
                />
              </div>
            )
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={handleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
              width: islandSize,
              height: islandSize,
              borderRadius: 9999,
              border: "none",
              background: "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: islandClickable ? "pointer" : "default",
              padding: 0,
              transform: `scale(${hoverScale})`,
              transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
              willChange: "transform",
            }}
          >
            {node.completed ? (
              <DoneNode r={islandRadius} />
            ) : node.current ? (
              <CurrentNode
                r={islandRadius}
                num={node.islandOrder}
                fontSize={Math.round(16 * scale)}
              />
            ) : (
              <LockedNode
                r={islandRadius}
                num={node.islandOrder}
                fontSize={Math.round(14 * scale)}
              />
            )}
          </button>

          {showLabel && (
            islandClickable ? (
              <button
                type="button"
                onClick={handleClick}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                style={{
                  position: "absolute",
                  top: "50%",
                  transform: `translateY(-50%) scale(${hoverScale})`,
                  ...(onLeft
                    ? { left: iconHalf + 10 }
                    : { right: iconHalf + 10 }),
                  width: labelWidth,
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
                  willChange: "transform",
                }}
              >
                <LabelCard
                  node={node}
                  isStory={false}
                  isDesktop={showDesktopDetails}
                  onContinue={onContinue}
                  scale={scale}
                />
              </button>
            ) : (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  transform: "translateY(-50%)",
                  ...(onLeft
                    ? { left: iconHalf + 10 }
                    : { right: iconHalf + 10 }),
                  width: labelWidth,
                  pointerEvents: "none",
                }}
              >
                <LabelCard
                  node={node}
                  isStory={false}
                  isDesktop={showDesktopDetails}
                  onContinue={onContinue}
                  scale={scale}
                />
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

function JourneySidebarPanel({
  journey,
  islands,
  islandsDone,
  totalWords,
  learnedWords,
  currentNode,
  comingUp,
  onContinue,
}: {
  journey: { topic: string };
  islands: PathNode[];
  islandsDone: number;
  totalWords: number;
  learnedWords: number;
  currentNode: PathNode | null;
  comingUp: PathNode[];
  onContinue: (node: PathNode) => void;
}) {
  const progressPct =
    islands.length > 0 ? (islandsDone / islands.length) * 100 : 0;
  const remainingIslands = Math.max(0, islands.length - islandsDone);

  return (
    <div className="flex-shrink-0" style={{ width: 220 }}>
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center gap-2">
            <Map className="h-4 w-4 text-gray-400" />
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
              Journey
            </p>
          </div>
          <h2 className="text-lg font-black leading-tight text-gray-900">
            {journey.topic}
          </h2>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
            Progress
          </p>
          <div className="mb-2 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-teal-500 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mt-4 flex gap-2">
            <StatBox value={islandsDone} label="done" tone="teal" />
            <StatBox value={remainingIslands} label="left" tone="gray" />
            <StatBox value={learnedWords} label="words" tone="dark" />
          </div>
        </div>


        {comingUp.length > 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
              Coming Up
            </p>
            <div className="space-y-3">
              {comingUp.map((node) => (
                <div key={node.id} className="flex items-center gap-2.5">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                    {node.type === "story" ? (
                      <BookOpen size={10} color="#fbbf24" />
                    ) : (
                      <Lock size={9} color="#d1d5db" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-gray-500">
                      {node.name}
                    </p>
                    <p
                      className={`mt-0.5 text-[9px] ${
                        node.type === "story" ? "text-amber-300" : "text-gray-300"
                      }`}
                    >
                      {node.type === "story"
                        ? "Story checkpoint"
                        : `${node.wordCount} words`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
            Journey Stats
          </p>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center justify-between">
              <span>Islands</span>
              <span className="font-bold text-gray-900">{islands.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Story checkpoints</span>
              <span className="font-bold text-gray-900">
                {pathNodeCountStories(islands.length)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Total words</span>
              <span className="font-bold text-gray-900">{totalWords}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "teal" | "gray" | "dark";
}) {
  const toneStyles = {
    teal: "bg-teal-50 text-teal-700",
    gray: "bg-gray-100 text-gray-500",
    dark: "bg-gray-900 text-white",
  }[tone];

  return (
    <div className={`flex-1 rounded-xl px-3 py-2 text-center ${toneStyles}`}>
      <div className="text-sm font-black">{value}</div>
      <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.16em] opacity-80">
        {label}
      </div>
    </div>
  );
}

function pathNodeCountStories(islandCount: number) {
  return Math.max(0, 7 - islandCount);
}

export default function JourneyPage() {
  const STORY_CACHE_KEY = "journey_story_checkpoint_cache_v1";
  const router = useRouter();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const storyRequestRef = useRef<Record<string, Promise<string | null>>>({});
  const [loading, setLoading] = useState(true);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [storyClickError, setStoryClickError] = useState<string | null>(null);
  const [checkpointStoryIds, setCheckpointStoryIds] = useState<
    Record<string, string>
  >({});
  const [journey, setJourney] = useState<{
    id: string;
    topic: string;
    words_per_week: number | null;
  } | null>(null);
  const [apiNodes, setApiNodes] = useState<ApiNode[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [pastJourneys, setPastJourneys] = useState<CompletedJourney[]>([]);
  const pageWidth = useElementWidth(pageRef, 920);
  const wide = isDesktopViewport && pageWidth > 560;
  const mapUiScale =
    pageWidth >= 560 ? Math.min(1.22, Math.max(1, pageWidth / 560)) : 1;

  useEffect(() => {
    const load = async () => {
      const [journeyRes, entRes, pastRes] = await Promise.all([
        fetch("/api/journey/active", { cache: "no-store" }),
        fetch("/api/entitlements"),
        fetch("/api/journey/past", { cache: "no-store" }),
      ]);
      if (journeyRes.ok) {
        const data = await journeyRes.json();
        setJourney(data.journey ?? null);
        setApiNodes(data.nodes ?? data.islands ?? []);
      }
      const ent = await entRes.json().catch(() => ({}));
      setIsPro(!!ent?.isPro);
      if (pastRes.ok) {
        const pastData = await pastRes.json();
        setPastJourneys(pastData.journeys ?? []);
      }
      setLoading(false);
    };
    void load();
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const syncViewport = () => setIsDesktopViewport(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

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

  const pathNodes = useMemo((): PathNode[] => {
    const sorted = [...apiNodes].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0),
    );
    const firstIncompleteId = sorted.find((node) => !node.completed_at)?.id;
    return sorted.map((node) => {
      const islandOrder =
        node.order && node.order <= 10 ? node.order : node.position;
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
        paywalled: node.node_type === "island" && !isPro && islandOrder > 2,
      };
    });
  }, [apiNodes, isPro]);

  const islands = pathNodes.filter((node) => node.type === "island");
  const islandsDone = islands.filter((node) => node.completed).length;
  const totalWords = islands.reduce((sum, node) => sum + node.wordCount, 0);
  const learnedWords = islands
    .filter((node) => node.completed)
    .reduce((sum, node) => sum + node.wordCount, 0);
  const currentNode = pathNodes.find((node) => node.current) ?? null;
  const currentNodeIndex = pathNodes.findIndex((node) => node.current);
  const pathD = buildPath(
    MAP_NODES.map((node) => ({ cx: node.bx, cy: node.cy })),
  );
  const progressPathD = useMemo(() => {
    if (pathNodes.length === 0) return "";
    if (currentNodeIndex >= 0) {
      const progressNodes = MAP_NODES.slice(0, currentNodeIndex + 1).map((node) => ({
        cx: node.bx,
        cy: node.cy,
      }));
      return progressNodes.length > 1 ? buildPath(progressNodes) : "";
    }
    return pathNodes.every((node) => node.completed) ? pathD : "";
  }, [currentNodeIndex, pathD, pathNodes]);
  const showMapLabels = pageWidth > 430;
  const showDesktopMapDetails = pageWidth > 960;
  const comingUp = pathNodes.filter((node) => !node.completed && !node.current).slice(0, 3);

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

  const resolveCheckpointStoryId = useCallback(async (node: PathNode) => {
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

      setStoryClickError(
        typeof data?.error === "string" ? data.error : "Couldn't open story checkpoint yet.",
      );
      return null;
    })();

    storyRequestRef.current[node.id] = request;
    try {
      return await request;
    } finally {
      delete storyRequestRef.current[node.id];
    }
  }, [journey, checkpointStoryIds, saveCheckpointStoryId]);

  useEffect(() => {
    if (!journey || !currentNode || currentNode.type !== "story") return;
    void (async () => {
      const storyId = await resolveCheckpointStoryId(currentNode);
      if (storyId) {
        router.prefetch(
          `/app/journey/${journey.id}/story/${storyId}?journeyNodeId=${encodeURIComponent(currentNode.id)}`,
        );
      }
    })();
  }, [journey, currentNode, resolveCheckpointStoryId, router]);

  const handleContinue = async (node: PathNode) => {
    if (!journey) return;
    setStoryClickError(null);
    if (node.type === "story") {
      const cachedStoryId = node.storyId ?? checkpointStoryIds[node.id];
      if (cachedStoryId) {
        router.push(
          `/app/journey/${journey.id}/story/${cachedStoryId}?journeyNodeId=${encodeURIComponent(node.id)}`,
        );
        return;
      }

      router.push(
        `/app/journey/${journey.id}/story-loading?journeyNodeId=${encodeURIComponent(node.id)}`,
      );
      return;
    }
    if (node.islandId) {
      const params = new URLSearchParams({ journeyFirst: "1" });
      if (node.current) params.set("learn", "true");
      router.push(`/app/topic-islands/${node.islandId}?${params.toString()}`);
      return;
    }
    const response = await fetch(`/api/journey/${journey.id}/start-island`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: node.islandOrder }),
    });
    const data = await response.json();
    if (data.islandId) {
      const params = new URLSearchParams({ journeyFirst: "1" });
      if (node.current) params.set("learn", "true");
      router.push(`/app/topic-islands/${data.islandId}?${params.toString()}`);
    }
  };

  const handleStoryOpen = (node: PathNode) => {
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
      `/app/journey/${journey.id}/story-loading?journeyNodeId=${encodeURIComponent(node.id)}`,
    );
  };

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
    <div className="min-h-screen bg-white px-4 py-6 md:px-6 md:py-8 lg:px-10">
      <div className="mx-auto w-full max-w-[1380px]">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
              Learning Path
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-gray-900">
              {journey.topic}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {learnedWords} / {totalWords} words learned
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/app/journey/past")}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#1a2332] px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#2d3a4d]"
            >
              <Clock className="h-3.5 w-3.5" />
              My Journeys
            </button>
            <button
              type="button"
              onClick={() => router.push("/app/journey/create")}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50"
            >
              <Plus className="h-3.5 w-3.5" />
              New Journey
            </button>
          </div>
        </div>

        <div
          ref={pageRef}
          style={{
            display: "flex",
            flexDirection: wide ? "row" : "column",
            gap: wide ? 32 : 24,
            width: "100%",
            alignItems: "flex-start",
          }}
        >
          <div style={{ flex: "1 1 760px", minWidth: 0, width: "100%" }}>
            <div
              className="relative w-full max-w-[600px] sm:rounded-3xl sm:bg-slate-50"
              style={{
                position: "relative",
                width: "100%",
                maxWidth: MAX_W,
                height: MAP_H,
                margin: "0 auto",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  overflow: "hidden",
                }}
              >
                <svg
                  viewBox={`0 0 ${BASE_W} ${MAP_H}`}
                  width="100%"
                  height={MAP_H}
                  preserveAspectRatio="none"
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "block",
                    pointerEvents: "none",
                  }}
                >
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth={22}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={1000}
                    style={{ vectorEffect: "non-scaling-stroke" }}
                  />
                  <path
                    d={pathD}
                    fill="none"
                    stroke="white"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeDasharray="12 16"
                    pathLength={1000}
                    style={{ vectorEffect: "non-scaling-stroke" }}
                  />
                  <path
                    d={progressPathD}
                    fill="none"
                    stroke="#14b8a6"
                    strokeWidth={10}
                    strokeLinecap="round"
                    style={{ vectorEffect: "non-scaling-stroke" }}
                  />
                </svg>

                {pathNodes.map((node, index) => (
                  <JourneyMapNode
                    key={node.id}
                    node={node}
                    baseNode={MAP_NODES[index] ?? MAP_NODES[0]}
                    showDesktopDetails={showDesktopMapDetails}
                    onContinue={(pathNode) =>
                      pathNode.type === "story"
                        ? handleStoryOpen(pathNode)
                        : void handleContinue(pathNode)
                    }
                    showLabel={showMapLabels}
                    scale={mapUiScale}
                  />
                ))}

                <div className="pointer-events-none absolute inset-x-0 bottom-0 pb-3 text-center">
                  <p className="text-[11px] font-semibold text-slate-300">
                    Finish to unlock your next journey
                  </p>
                </div>
              </div>
            </div>
            {storyClickError && (
              <p className="mt-3 text-center text-xs font-semibold text-rose-500">
                {storyClickError}
              </p>
            )}

          </div>

          {wide && (
            <JourneySidebarPanel
              journey={journey}
              islands={islands}
              islandsDone={islandsDone}
              totalWords={totalWords}
              learnedWords={learnedWords}
              currentNode={currentNode}
              comingUp={comingUp}
              onContinue={(pathNode) =>
                pathNode.type === "story"
                  ? handleStoryOpen(pathNode)
                  : void handleContinue(pathNode)
              }
            />
          )}
        </div>

        <BrowsePreviousJourneys pastJourneys={pastJourneys} />
      </div>
    </div>
  );
}
