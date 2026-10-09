"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import DiagnosticFlow from "@/components/app/Pronunciation/DiagnosticFlow";
import AppPageLoading from "@/components/app/AppPageLoading";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCharacterSet } from "@/contexts/CharacterSetContext";

type CompareData = {
  day1Overall: number | null;
  remeasureOverall: number | null;
  delta: number | null;
  perTag: { tag: string; label: string; before: number | null; after: number | null; delta: number | null }[];
  sentences: {
    index: number;
    hanzi: string;
    pinyin: string;
    day1Score: number | null;
    remeasureScore: number | null;
    day1AudioUrl: string | null;
    remeasureAudioUrl: string | null;
  }[];
  nextWeakSounds: { id: string; syllable: string; pinyin: string | null }[];
};

export default function RemeasurePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();
  const [mode, setMode] = useState<"flow" | "compare">("flow");
  const [compare, setCompare] = useState<CompareData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);

  const loadCompare = async () => {
    setLoadingCompare(true);
    const res = await fetch("/api/pronunciation/diagnostic/compare", { cache: "no-store" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      setError(typeof data?.error === "string" ? data.error : "Couldn't load comparison.");
      setLoadingCompare(false);
      return;
    }
    setCompare(data);
    setMode("compare");
    setLoadingCompare(false);
  };

  useEffect(() => {
    // If remeasure already complete, jump to compare.
    void (async () => {
      const res = await fetch("/api/pronunciation/diagnostic/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passLabel: "remeasure" }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.completed) void loadCompare();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (mode === "compare") {
    if (loadingCompare || !compare) {
      return (
        <AppPageLoading label={convertText(t("Loading comparison…"))} />
      );
    }

    const biggest = compare.perTag.find((t) => (t.delta ?? 0) > 0) ?? compare.perTag[0];

    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="text-center">
          <div className="relative mx-auto mb-4 h-36 w-36 overflow-hidden rounded-3xl">
            <Image src="/pronunciation/milestone-pronunciation.png" alt="" fill className="object-cover" />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-blue)]">{convertText(t("Progress check"))}</p>
          <h1 className="lingo-display mt-2 text-3xl font-bold text-[var(--lingo-navy)]">{convertText(t("Look how you've improved"))}</h1>
          <div className="mt-6 flex items-end justify-center gap-3">
            <span className="text-2xl font-bold text-[var(--lingo-text-muted)]">
              {compare.day1Overall == null ? "—" : Math.round(compare.day1Overall)}
            </span>
            <span className="pb-1 text-[var(--lingo-text-muted)]">→</span>
            <span className="lingo-display text-5xl font-bold text-[var(--lingo-navy)]">
              {compare.remeasureOverall == null ? "—" : Math.round(compare.remeasureOverall)}
            </span>
          </div>
          {compare.delta != null && (
            <p className="mt-2 text-sm font-semibold" style={{ color: compare.delta >= 0 ? "#0f766e" : "#9f1c14" }}>
              {compare.delta >= 0 ? "+" : ""}
              {Math.round(compare.delta)} {convertText(t("since your first check"))}
            </p>
          )}
        </div>

        {biggest && (
          <div
            className="mt-8 rounded-[24px] border bg-white p-5"
            style={{ borderColor: "var(--lingo-border)", boxShadow: "var(--lingo-shadow-card)" }}
          >
            <h2 className="text-sm font-bold text-[var(--lingo-navy)]">{convertText(t("Your biggest improvement"))}</h2>
            <p className="mt-2 text-lg font-bold text-[var(--lingo-navy)]">{biggest.label}</p>
            <p className="text-sm text-[var(--lingo-text-muted)]">
              {biggest.before == null ? "—" : Math.round(biggest.before)} →{" "}
              {biggest.after == null ? "—" : Math.round(biggest.after)}
            </p>
          </div>
        )}

        <div className="mt-5 rounded-[24px] border bg-white p-5" style={{ borderColor: "var(--lingo-border)" }}>
          <h2 className="text-sm font-bold text-[var(--lingo-navy)]">{convertText(t("Full breakdown"))}</h2>
          <div className="mt-3 space-y-2">
            {compare.perTag.map((tag) => (
              <div key={tag.tag} className="flex items-center justify-between rounded-xl bg-[var(--lingo-sky-pale)] px-3 py-2.5">
                <span className="text-sm font-semibold text-[var(--lingo-navy)]">{tag.label}</span>
                <span className="text-xs font-bold text-[var(--lingo-text-muted)]">
                  {tag.before == null ? "—" : Math.round(tag.before)} → {tag.after == null ? "—" : Math.round(tag.after)}
                  {tag.delta != null && (
                    <span className="ml-2" style={{ color: tag.delta >= 0 ? "#0f766e" : "#9f1c14" }}>
                      {tag.delta >= 0 ? "+" : ""}
                      {Math.round(tag.delta)}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border bg-white p-5" style={{ borderColor: "var(--lingo-border)" }}>
          <h2 className="text-sm font-bold text-[var(--lingo-navy)]">{convertText(t("Hear the difference"))}</h2>
          <div className="mt-3 space-y-3">
            {compare.sentences.map((s) => (
              <div key={s.index} className="rounded-xl bg-[var(--lingo-sky-pale)] p-3">
                <p className="text-sm font-bold text-[var(--lingo-navy)]">{convertText(s.hanzi)}</p>
                <p className="text-xs text-[var(--lingo-text-muted)]">{s.pinyin}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {s.day1AudioUrl ? (
                    <button
                      type="button"
                      onClick={() => new Audio(s.day1AudioUrl!).play()}
                      className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[var(--lingo-navy)]"
                    >
                      {convertText(t("Day 1"))}
                    </button>
                  ) : (
                    <span className="text-xs text-[var(--lingo-text-muted)]">{convertText(t("Day 1 audio unavailable"))}</span>
                  )}
                  {s.remeasureAudioUrl ? (
                    <button
                      type="button"
                      onClick={() => new Audio(s.remeasureAudioUrl!).play()}
                      className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[var(--lingo-navy)]"
                    >
                      {convertText(t("Today"))}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-[24px] border bg-white p-5" style={{ borderColor: "var(--lingo-border)" }}>
          <h2 className="text-sm font-bold text-[var(--lingo-navy)]">{convertText(t("What's next?"))}</h2>
          {compare.nextWeakSounds.length > 0 ? (
            <p className="mt-2 text-sm text-[var(--lingo-text)]">
              {convertText(t("Your next challenge:"))}{" "}
              <span className="font-bold">
                {compare.nextWeakSounds.map((w) => w.pinyin ?? convertText(w.syllable)).join(", ")}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-[var(--lingo-text-muted)]">{convertText(t("Keep up daily practice to lock in these gains."))}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => router.push("/app/pronunciation")}
              className="rounded-2xl px-4 py-2.5 text-sm font-bold text-white"
              style={{ background: "var(--lingo-accent-gradient)" }}
            >
              {convertText(t("Practice this →"))}
            </button>
            <Link href="/app/pronunciation" className="rounded-2xl border border-[var(--lingo-accent-border)] px-4 py-2.5 text-sm font-bold text-[var(--lingo-navy)]">
              {convertText(t("Back to pronunciation"))}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && <p className="px-4 pt-4 text-center text-sm text-red-600">{error}</p>}
      <DiagnosticFlow
        passLabel="remeasure"
        onFinished={() => {
          void loadCompare();
        }}
      />
    </>
  );
}
