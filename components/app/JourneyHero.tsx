"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import PathNode, { type JourneyNode } from "@/components/app/PathNode";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function JourneyHero({
  journey,
  nodes,
  status = journey ? "ready" : "empty",
  onRetry,
}: {
  journey: { id: string; topic: string } | null;
  nodes: JourneyNode[];
  status?: "ready" | "empty" | "error" | "loading";
  onRetry?: () => void;
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

  if (status === "loading" || status === "error") {
    return (
      <Card className="mb-5" padded={false} hover={false} style={{ padding: "1.5rem" }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-teal)]">
          Active journey
        </p>
        {status === "loading" ? (
          <div className="mt-3 space-y-3">
            <div className="h-8 w-56 animate-pulse rounded-lg bg-[var(--lingo-sky-pale)]" />
            <div className="h-4 w-72 max-w-full animate-pulse rounded bg-[var(--lingo-sky-pale)]" />
            <div className="h-10 w-full animate-pulse rounded-full bg-[var(--lingo-sky-pale)]" />
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--lingo-text-muted)]">
              Couldn&apos;t load your journey.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="text-sm font-bold text-[var(--lingo-blue)]"
            >
              Retry
            </button>
          </div>
        )}
      </Card>
    );
  }

  if (!journey) {
    return (
      <Card
        className="mb-5"
        hover={false}
        style={{ borderStyle: "dashed", padding: "1.5rem" }}
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
        <Button
          className="mt-5"
          onClick={() => router.push("/app/journey/create")}
        >
          Create a journey <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </Card>
    );
  }

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => router.push("/app/journey")}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push("/app/journey");
        }
      }}
      padded={false}
      className="group mb-5 cursor-pointer p-5 sm:p-6"
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
    </Card>
  );
}
