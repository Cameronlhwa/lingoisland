"use client";

import { BookOpen, Check, Lock, Mic } from "lucide-react";

export type JourneyNode = {
  id: string;
  node_type: "island" | "story" | "tone_practice";
  position: number;
  name: string;
  hint?: string | null;
  word_count?: number | null;
  island_id?: string | null;
  story_id?: string | null;
  completed_at?: string | null;
  current?: boolean;
  order?: number; // legacy field — same as step_order
};

export default function PathNode({
  node,
  compact = false,
}: {
  node: JourneyNode;
  compact?: boolean;
}) {
  const isStory = node.node_type === "story";
  const isTonePractice = node.node_type === "tone_practice";
  const size = compact ? "h-7 w-7" : "h-9 w-9";
  const shape = isStory || isTonePractice ? "rounded-xl" : "rounded-full";
  const done = !!node.completed_at;
  const current = !!node.current;

  const colorClass = done
    ? isStory
      ? "border-amber-400 bg-amber-400 text-white"
      : isTonePractice
        ? "border-sky-400 bg-sky-400 text-white"
        : "border-teal-500 bg-teal-500 text-white"
    : current
      ? "border-transparent bg-[var(--lingo-btn-bg)] text-white ring-2 ring-[var(--lingo-accent-border)] ring-offset-1"
      : "border-gray-200 bg-gray-50 text-gray-300";

  return (
    <div
      className={`${size} ${shape} ${colorClass} flex items-center justify-center border-2 transition-all`}
    >
      {done ? (
        <Check size={compact ? 10 : 13} strokeWidth={3} />
      ) : current ? (
        isStory ? (
          <BookOpen size={compact ? 10 : 13} />
        ) : isTonePractice ? (
          <Mic size={compact ? 10 : 13} />
        ) : (
          <span className="text-xs font-bold">
            {Math.max(1, Math.round(node.position ?? node.order ?? 1))}
          </span>
        )
      ) : isStory ? (
        <BookOpen size={compact ? 9 : 12} />
      ) : isTonePractice ? (
        <Mic size={compact ? 9 : 12} />
      ) : (
        <Lock size={compact ? 9 : 11} />
      )}
    </div>
  );
}
