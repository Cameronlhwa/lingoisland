"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import PathNode, { type JourneyNode } from "@/components/app/PathNode";
import {
  HSK_CARD_BORDER,
  HSK_CARD_SHADOW,
  HSK_CARD_SHADOW_HOVER,
} from "@/lib/glossy-theme";

export default function JourneyHero({
  journey,
  nodes,
}: {
  journey: { id: string; topic: string } | null;
  nodes: JourneyNode[];
}) {
  const router = useRouter();

  const sortedNodes = useMemo(
    () => [...nodes].sort((a, b) => a.position - b.position),
    [nodes],
  );
  const currentNode =
    sortedNodes.find((n) => !n.completed_at && !!n.island_id) ??
    sortedNodes.find((n) => !n.completed_at);
  const islands = sortedNodes.filter((n) => n.node_type === "island");
  const getIslandWordCount = (node: JourneyNode) => {
    if (typeof node.word_count === "number" && node.word_count > 0) {
      return node.word_count;
    }
    const order = node.order ?? node.position ?? 0;
    return order === 1 ? 5 : 10;
  };
  const wordsLearned = islands.reduce(
    (sum, n) => sum + (n.completed_at ? getIslandWordCount(n) : 0),
    0,
  );
  const totalWords = islands.reduce((sum, n) => sum + getIslandWordCount(n), 0);

  if (!journey) {
    return (
      <section
        className="mb-5 rounded-2xl bg-white p-6 sm:p-7"
        style={{
          border: "1px dashed var(--lingo-accent-border)",
          boxShadow: HSK_CARD_SHADOW,
        }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-teal)]">
          Active journey
        </p>
        <h2 className="lingo-display mt-2 text-2xl text-[var(--lingo-navy)]">
          Start your first journey
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--lingo-text-muted)]">
          Pick a topic and get a personalized 5-island path with stories woven
          in to lock in the words.
        </p>
        <button
          type="button"
          onClick={() => router.push("/app/journey/create")}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
          style={{
            background: "var(--lingo-navy)",
            boxShadow: "0 8px 18px -10px rgba(7,30,46,.7)",
          }}
        >
          Create a journey <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </section>
    );
  }

  return (
    <section
      role="button"
      tabIndex={0}
      onClick={() => router.push("/app/journey")}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push("/app/journey");
        }
      }}
      className="group mb-5 cursor-pointer rounded-2xl bg-white p-5 transition-all hover:-translate-y-0.5 sm:p-6"
      style={{ border: HSK_CARD_BORDER, boxShadow: HSK_CARD_SHADOW }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = HSK_CARD_SHADOW_HOVER;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = HSK_CARD_SHADOW;
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-teal)]">
            Active journey
          </p>
          <h2 className="lingo-display mt-1.5 text-2xl text-[var(--lingo-navy)] sm:text-[28px]">
            {journey.topic}
          </h2>
          <p className="mt-1.5 text-sm text-[var(--lingo-text-muted)]">
            5 islands · 2 stories · {totalWords} words
          </p>
        </div>
        <div className="text-right">
          <p className="lingo-display text-3xl leading-none text-[var(--lingo-navy)]">
            {wordsLearned}
          </p>
          <p className="mt-1 text-sm text-[var(--lingo-text-muted)]">
            of {totalWords} words
          </p>
        </div>
      </div>

      {sortedNodes.length > 0 && (
        <div className="mt-5 flex w-full items-center">
          {sortedNodes.map((node, i) => (
            <div key={node.id} className="flex min-w-0 flex-1 items-center">
              <div className="flex flex-1 justify-center">
                <PathNode
                  node={{ ...node, current: currentNode?.id === node.id }}
                  compact
                />
              </div>
              {i < sortedNodes.length - 1 && (
                <div
                  className="mx-1 h-px max-w-10 flex-1"
                  style={{
                    background: node.completed_at
                      ? "var(--lingo-teal)"
                      : "var(--lingo-accent-border)",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div
        className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-4"
        style={{ borderColor: "var(--lingo-accent-border)" }}
      >
        <p className="text-sm text-[var(--lingo-text-muted)]">
          {currentNode ? (
            <>
              Up next:{" "}
              <span className="font-semibold text-[var(--lingo-navy)]">
                {currentNode.name}
              </span>
              {currentNode.node_type === "story" ? (
                <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                  Story
                </span>
              ) : null}
            </>
          ) : (
            "Journey complete"
          )}
        </p>
        <span className="inline-flex items-center gap-1 text-sm font-bold text-[var(--lingo-blue)] transition-colors group-hover:text-[var(--lingo-navy)]">
          View journey <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
    </section>
  );
}
