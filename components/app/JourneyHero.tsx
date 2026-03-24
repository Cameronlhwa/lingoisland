"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import PathNode, { type JourneyNode } from "@/components/app/PathNode";

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
  const islandsDone = islands.filter((n) => n.completed_at).length;
  const wordsLearned = islands.reduce(
    (sum, n) => sum + (n.completed_at ? n.word_count ?? 10 : 0),
    0,
  );
  const totalWords = islands.reduce((sum, n) => sum + (n.word_count ?? 10), 0);

  if (!journey) {
    return (
      <div className="mb-4 rounded-2xl border-2 border-dashed border-gray-200 bg-white p-6 text-center transition-all hover:border-gray-400">
        <p className="mb-3 text-3xl">🗺️</p>
        <h2 className="mb-1 text-base font-black text-gray-900">
          Start your first Journey
        </h2>
        <p className="mx-auto mb-4 max-w-xs text-sm text-gray-400">
          Pick a topic. Get a personalised 5-island path with stories woven in
          to lock in the words.
        </p>
        <button
          onClick={() => router.push("/app/journey/create")}
          className="rounded-xl bg-gray-900 px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-gray-700"
        >
          Create a Journey →
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => router.push("/app/journey")}
      className="group mb-4 cursor-pointer rounded-2xl border border-gray-200 bg-white p-5 transition-all hover:border-gray-400 hover:shadow-sm"
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Active Journey
          </p>
          <h2 className="text-lg font-black text-gray-900">{journey.topic}</h2>
          <p className="mt-0.5 text-xs text-gray-400">
            5 islands · 2 stories · {totalWords} words
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black leading-none text-gray-900">
            {wordsLearned}
          </p>
          <p className="mt-0.5 text-xs text-gray-400">of {totalWords} words</p>
        </div>
      </div>

      <div className="mb-4 flex items-center">
        {sortedNodes.map((node, i) => (
          <div key={node.id} className="flex min-w-0 flex-1 items-center">
            <div className="flex flex-1 justify-center">
              <PathNode
                node={{ ...node, current: currentNode?.id === node.id }}
                compact
              />
            </div>
            {i < sortedNodes.length - 1 ? (
              <div
                className={`h-px w-2 flex-shrink-0 ${node.completed_at ? "bg-teal-300" : "bg-gray-200"}`}
              />
            ) : null}
          </div>
        ))}
      </div>

      <div className="mb-3 h-1.5 rounded-full bg-gray-100">
        <div
          className="h-1.5 rounded-full bg-teal-500 transition-all"
          style={{ width: `${(islandsDone / 5) * 100}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Up next:{" "}
          <span className="font-semibold text-gray-700">
            {currentNode?.name ?? "Journey"}
          </span>
          {currentNode?.node_type === "story" ? (
            <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
              Story
            </span>
          ) : null}
        </p>
        <p className="text-xs font-medium text-gray-400 transition-colors group-hover:text-gray-700">
          View journey →
        </p>
      </div>
    </div>
  );
}
