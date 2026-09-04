"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Lock, Sparkles } from "lucide-react";
import {
  HSK_CARD_BORDER,
  HSK_CARD_SHADOW,
  HSK_BTN_GRADIENT,
  HSK_BTN_SHADOW,
} from "@/lib/glossy-theme";
import { formatHskLevel } from "@/lib/utils/hsk";

type Unit = {
  id: string;
  unit_number: number;
  milestone_level: number;
  title: string;
  title_zh: string | null;
  theme: string | null;
  interest_tag: string | null;
  status: "sketch" | "building" | "ready" | "completed";
  journey_id: string | null;
  completed_at: string | null;
};

type CurriculumResponse = {
  curriculum:
    | {
        id: string;
        current_milestone_level: number;
        target_level: number;
        status: string;
        current_level_label?: string;
        target_level_label?: string;
      }
    | null;
  units: Unit[];
  currentUnitId: string | null;
};

export default function HskCurriculumOverview({
  basePath = "/app",
}: {
  basePath?: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<CurriculumResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/hsk/curriculum", { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as CurriculumResponse;
        if (cancelled) return;
        if (!res.ok) {
          setError("Couldn't load your path.");
        } else {
          setData(json);
        }
      } catch {
        if (!cancelled) setError("Couldn't load your path.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openUnit = (unit: Unit) => {
    if (unit.status === "ready" && unit.journey_id) {
      router.push(`${basePath}/journey/${unit.journey_id}`);
      return;
    }
    router.push(`${basePath}/journey/build/${unit.id}`);
  };

  const currentUnitId = data?.currentUnitId ?? null;
  const units = useMemo(
    () => [...(data?.units ?? [])].sort((a, b) => a.unit_number - b.unit_number),
    [data],
  );
  const doneCount = units.filter((u) => u.status === "completed").length;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-[var(--lingo-text-muted)]">
        Loading your path…
      </div>
    );
  }

  if (error || !data?.curriculum) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="mb-3 text-4xl">🧭</p>
        <h2 className="lingo-display text-2xl text-[var(--lingo-navy)]">
          Your HSK path isn&apos;t set up yet
        </h2>
        <p className="mt-2 text-sm text-[var(--lingo-text-muted)]">
          {error ?? "Answer a few quick questions and we'll build your first unit."}
        </p>
      </div>
    );
  }

  const c = data.curriculum;

  return (
    <div className="min-h-screen bg-white px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--lingo-teal)]">
            Your curriculum
          </p>
          <h1 className="lingo-display mt-1 text-3xl text-[var(--lingo-navy)]">
            My HSK Path
          </h1>
          <p className="mt-1.5 text-sm text-[var(--lingo-text-muted)]">
            {c.current_level_label ?? formatHskLevel(c.current_milestone_level)}
            <span className="mx-1.5 opacity-40">→</span>
            {c.target_level_label ?? formatHskLevel(c.target_level)}
            <span className="mx-2 opacity-30">·</span>
            {doneCount} / {units.length} units done
          </p>
        </header>

        <ol className="space-y-3">
          {units.map((unit) => {
            const isCurrent = unit.id === currentUnitId;
            const isDone = unit.status === "completed";
            const isReady = unit.status === "ready";
            const locked = !isCurrent && !isDone && !isReady;

            return (
              <li key={unit.id}>
                <div
                  className="rounded-2xl bg-white p-4 sm:p-5"
                  style={{
                    border: isCurrent
                      ? "1.5px solid var(--lingo-blue)"
                      : HSK_CARD_BORDER,
                    boxShadow: isCurrent ? HSK_CARD_SHADOW : "none",
                    opacity: locked ? 0.72 : 1,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{
                        background: isDone
                          ? "var(--lingo-teal)"
                          : isCurrent
                            ? "var(--lingo-navy)"
                            : "var(--lingo-sky-pale)",
                        color: isDone || isCurrent ? "#fff" : "var(--lingo-text-muted)",
                      }}
                    >
                      {isDone ? (
                        <Check className="h-4 w-4" strokeWidth={3} />
                      ) : locked ? (
                        <Lock className="h-3.5 w-3.5" />
                      ) : (
                        unit.unit_number
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-text-muted)]">
                          Unit {unit.unit_number}
                        </span>
                        <span className="rounded-full bg-[var(--lingo-sky-pale)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--lingo-blue)]">
                          {formatHskLevel(unit.milestone_level)}
                        </span>
                        {unit.interest_tag && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--lingo-text-muted)]">
                            <Sparkles className="h-3 w-3" />
                            {unit.interest_tag}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-0.5 text-[15px] font-bold text-[var(--lingo-navy)]">
                        {unit.title}
                      </h3>
                      {unit.title_zh && (
                        <p className="text-xs text-[var(--lingo-text-muted)]">
                          {unit.title_zh}
                        </p>
                      )}
                      {locked ? (
                        <p className="mt-1.5 text-xs text-[var(--lingo-text-muted)]">
                          Built when you get here · ~45 words
                        </p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openUnit(unit)}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white transition-transform hover:-translate-y-0.5"
                          style={{
                            background: isDone
                              ? "var(--lingo-navy)"
                              : HSK_BTN_GRADIENT,
                            boxShadow: isDone ? "none" : HSK_BTN_SHADOW,
                          }}
                        >
                          {isDone
                            ? "Review unit"
                            : isReady
                              ? "Continue"
                              : "Start this unit"}
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
