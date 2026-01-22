"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type QuizStatsRow = {
  forgot_count: number;
  hard_count: number;
  good_count: number;
  easy_count: number;
  new_count: number;
  total_count: number;
};

export function QuizMasteryStats({ quizIslandId }: { quizIslandId: string }) {
  const [stats, setStats] = useState<QuizStatsRow | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const supabase = createClient();
        setFailed(false);

        // Some deployments name the RPC arg `quiz_island_id`, others use `p_quiz_island_id`.
        const first = await supabase.rpc("get_quiz_stats", {
          quiz_island_id: quizIslandId,
        } as never);

        const second =
          first.error &&
          (await supabase.rpc("get_quiz_stats", {
            p_quiz_island_id: quizIslandId,
          } as never));

        const data = (second ? second.data : first.data) as unknown;
        const error = second ? second.error : first.error;

        if (cancelled) return;

        if (error) {
          console.error("Error loading quiz stats:", error);
          setStats(null);
          setFailed(true);
          return;
        }

        const row = Array.isArray(data) ? data[0] : data;
        setStats((row as QuizStatsRow) || null);
      } catch (e) {
        if (cancelled) return;
        console.error("Error loading quiz stats:", e);
        setStats(null);
        setFailed(true);
      }
    }

    if (quizIslandId) load();
    return () => {
      cancelled = true;
    };
  }, [quizIslandId]);

  const total = stats?.total_count ?? 0;

  const bars = useMemo(() => {
    const s = stats;
    return [
      {
        key: "forgot",
        label: "Forgot",
        count: s?.forgot_count ?? 0,
        colorClass: "bg-red-500",
      },
      {
        key: "hard",
        label: "Hard",
        count: s?.hard_count ?? 0,
        colorClass: "bg-orange-500",
      },
      {
        key: "good",
        label: "Good",
        count: s?.good_count ?? 0,
        colorClass: "bg-blue-500",
      },
      {
        key: "easy",
        label: "Easy",
        count: s?.easy_count ?? 0,
        colorClass: "bg-green-500",
      },
    ] as const;
  }, [stats]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Your progress</h2>
        <p className="mt-1 text-sm text-gray-600">Cards by mastery level</p>
      </div>

      {failed ? (
        <div className="text-sm text-gray-600">Progress unavailable</div>
      ) : total <= 0 ? (
        <div className="text-sm text-gray-600">No cards yet</div>
      ) : (
        <>
          <div className="flex items-end justify-between gap-4">
            {bars.map((b) => {
              const heightPercent = total > 0 ? (b.count / total) * 100 : 0;
              return (
                <div key={b.key} className="flex flex-1 flex-col items-center">
                  <div className="flex h-28 w-full items-end rounded-lg bg-gray-100 px-2">
                    <div
                      className={`w-full rounded-md ${b.colorClass}`}
                      style={{
                        height: `${heightPercent}%`,
                        minHeight: b.count > 0 ? 6 : 0,
                      }}
                      aria-label={`${b.label}: ${b.count}`}
                    />
                  </div>
                  <div className="mt-2 text-xs font-medium text-gray-600">
                    {b.label}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">
                    {b.count}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 text-sm text-gray-700">
            <span className="font-medium text-gray-900">New:</span>{" "}
            {stats?.new_count ?? 0}
          </div>
        </>
      )}
    </div>
  );
}


