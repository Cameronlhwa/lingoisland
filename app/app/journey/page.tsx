"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Lock } from "lucide-react";
import JourneyOnboardingFlow from "@/components/Onboarding/JourneyOnboardingFlow";

export default function JourneyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [journey, setJourney] = useState<{
    id: string;
    topic: string;
    words_per_week: number | null;
    completed_at: string | null;
  } | null>(null);
  const [islands, setIslands] = useState<
    Array<{
      id: string;
      order: number;
      name: string;
      zh: string | null;
      story_idea: string | null;
      island_id: string | null;
      completed_at: string | null;
    }>
  >([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/journey/active", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setJourney(data.journey);
        setIslands(data.islands ?? []);
      }
      const ent = await fetch("/api/entitlements").then((r) => r.json());
      setIsPro(!!ent?.isPro);
      setLoading(false);
    };
    void load();
  }, []);

  const learned = islands.filter((i) => i.completed_at).length * 10;
  const total = 50;
  const progress = Math.min(100, (learned / total) * 100);

  const nextIsland = islands.find(
    (i) => !i.completed_at && (i.order === 1 || isPro),
  );

  if (wizardOpen) {
    return (
      <div className="min-h-screen bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <button
            type="button"
            onClick={() => setWizardOpen(false)}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Back
          </button>
        </div>
        <Suspense fallback={<div className="p-6 text-slate-600">Loading…</div>}>
          <JourneyOnboardingFlow skipWelcome />
        </Suspense>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600">
        Loading…
      </div>
    );
  }

  if (!journey) {
    return (
      <div className="mx-auto max-w-lg px-6 py-12">
        <h1 className="text-2xl font-black text-slate-900">Your journey</h1>
        <p className="mt-2 text-slate-600">
          Create a personalised path of five topic islands.
        </p>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="mt-8 w-full rounded-xl bg-slate-900 py-4 font-semibold text-white"
        >
          + New Journey
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">{journey.topic}</h1>
          <p className="mt-1 text-slate-600">
            {Math.min(learned, total)} / {total} words learned
          </p>
        </div>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900"
        >
          + New Journey
        </button>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Journey Progress
        </p>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-lg font-bold text-slate-900">
            {Math.min(learned, total)} / {total} words
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-teal-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <ul className="mt-8 space-y-3">
        {islands.map((island) => {
          const done = !!island.completed_at;
          const locked = !isPro && island.order > 1;
          const current =
            !done &&
            !locked &&
            nextIsland?.id === island.id;
          return (
            <li
              key={island.id}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-4 py-4 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 ${
                    done
                      ? "border-teal-500 bg-teal-500 text-white"
                      : current
                        ? "border-slate-900 bg-slate-900 text-white ring-2 ring-slate-300"
                        : locked
                          ? "border-slate-200 bg-white text-slate-300"
                          : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {done ? (
                    <Check className="h-5 w-5" strokeWidth={2.5} />
                  ) : locked ? (
                    <Lock className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-bold">{island.order}</span>
                  )}
                </div>
                <div>
                  <p className="font-bold text-slate-900">
                    {island.name}
                    {island.zh ? (
                      <span className="ml-2 font-normal text-slate-500">
                        {island.zh}
                      </span>
                    ) : null}
                  </p>
                  {island.story_idea ? (
                    <p className="mt-1 text-sm text-slate-600">
                      {island.story_idea}
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 md:ml-4">
                {done ? (
                  <span className="text-sm font-semibold text-teal-600">
                    Done ✓
                  </span>
                ) : locked ? null : current && island.island_id ? (
                  <Link
                    href={`/app/topic-islands/${island.island_id}`}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Continue →
                  </Link>
                ) : current && !island.island_id ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await fetch(
                        `/api/journey/${journey.id}/start-island`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ order: island.order }),
                        },
                      );
                      const data = await res.json();
                      if (data.islandId) {
                        router.push(`/app/topic-islands/${data.islandId}`);
                      }
                    }}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Continue →
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => setWizardOpen(true)}
        className="mt-10 w-full rounded-2xl border-2 border-dashed border-slate-300 py-4 text-sm font-semibold text-slate-700"
      >
        + Create a new journey after completing this one
      </button>
    </div>
  );
}
