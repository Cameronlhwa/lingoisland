"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import {
  HSK_BTN_GRADIENT,
  HSK_BTN_SHADOW,
  HSK_CARD_SHADOW,
} from "@/lib/glossy-theme";
import {
  nextHskPathTargetLevel,
  HSK_PATH_LEVEL_OPTIONS,
} from "@/lib/hsk/pathStandard";
import { formatHskLevel } from "@/lib/utils/hsk";
import type {
  ChecklistDecoy,
  ChecklistItem,
  ChecklistWord,
} from "@/lib/hsk/placementChecklist";

const NAVY = "#071E2E";
const MUTED = "#5A7A90";
const BORDER = "#C2DCF0";

const BTN_PRIMARY =
  "flex w-full min-h-[48px] items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:brightness-100 sm:text-base";

export type ChecklistComplete = {
  estimatedLevel: number;
  targetLevel: number;
};

export default function HskVocabChecklist({
  onComplete,
  heading = "Tap the words you know",
}: {
  onComplete: (result: ChecklistComplete) => void;
  heading?: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [words, setWords] = useState<ChecklistWord[]>([]);
  const [decoys, setDecoys] = useState<ChecklistDecoy[]>([]);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [estimatedLevel, setEstimatedLevel] = useState<number | null>(null);
  const [targetLevel, setTargetLevel] = useState(2);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          const { data, error: anonErr } = await supabase.auth.signInAnonymously();
          if (anonErr) throw new Error(anonErr.message || "Could not start a guest session");
          user = data.user;
        }
        if (!user) throw new Error("Could not start a guest session");

        const res = await fetch("/api/hsk/placement-checklist", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "Could not load the checklist");
        if (cancelled) return;
        setItems(Array.isArray(json.items) ? json.items : []);
        setWords(Array.isArray(json.words) ? json.words : []);
        setDecoys(Array.isArray(json.decoys) ? json.decoys : []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load the checklist");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const toggle = (id: string) => {
    if (estimatedLevel != null) return;
    setKnown((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const knownWordIds = words.filter((w) => known.has(w.id)).map((w) => w.id);
      const knownDecoyIds = decoys.filter((d) => known.has(d.id)).map((d) => d.id);
      const res = await fetch("/api/hsk/placement-checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words, decoys, knownWordIds, knownDecoyIds }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Could not score the checklist");
      const level = Number(json.estimatedLevel) || 1;
      setEstimatedLevel(level);
      setTargetLevel(nextHskPathTargetLevel(level));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: MUTED }}>
        Loading words…
      </p>
    );
  }

  if (estimatedLevel != null) {
    return (
      <div>
        <label className="block text-sm font-medium" style={{ color: NAVY }}>
          Which HSK level are you preparing for?
        </label>
        <select
          className="mt-2 w-full rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: BORDER, color: NAVY }}
          value={targetLevel}
          onChange={(e) => setTargetLevel(Number(e.target.value))}
        >
          {HSK_PATH_LEVEL_OPTIONS.map((lvl) => (
            <option key={lvl} value={lvl}>
              {formatHskLevel(lvl)}
            </option>
          ))}
        </select>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          className={`${BTN_PRIMARY} mt-4`}
          style={{ background: HSK_BTN_GRADIENT, boxShadow: HSK_BTN_SHADOW }}
          onClick={() => onComplete({ estimatedLevel, targetLevel })}
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2
        className="text-xl font-bold"
        style={{ fontFamily: "'Lora', Georgia, serif", color: NAVY }}
      >
        {heading}
      </h2>
      <p className="mt-2 text-sm" style={{ color: MUTED }}>
        Tap every word you recognize. No score is shown — this just places you
        at the right starting point. Some items are not real words.
      </p>
      <div className="mt-5 grid max-h-[52vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
        {items.map((item) => {
          const on = known.has(item.id);
          return (
            <button
              key={`${item.kind}-${item.id}`}
              type="button"
              onClick={() => toggle(item.id)}
              className="rounded-xl border px-2 py-2.5 text-center transition-colors"
              style={{
                borderColor: on ? NAVY : BORDER,
                background: on ? NAVY : "white",
                color: on ? "white" : NAVY,
                boxShadow: HSK_CARD_SHADOW,
                fontFamily: "'Noto Sans SC', 'PingFang SC', sans-serif",
              }}
            >
              <span
                className="block text-lg leading-none"
                style={{ fontFamily: "'Noto Sans SC', 'PingFang SC', sans-serif" }}
              >
                {item.hanzi}
              </span>
              <span className="mt-1 block text-[10px] leading-none opacity-70">
                {item.pinyin}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs" style={{ color: "#8AABBF" }}>
        {known.size} marked as known
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <button
        className={`${BTN_PRIMARY} mt-4`}
        style={{ background: HSK_BTN_GRADIENT, boxShadow: HSK_BTN_SHADOW }}
        disabled={submitting || items.length === 0}
        onClick={submit}
      >
        {submitting ? "Placing you…" : "Continue"}
      </button>
    </div>
  );
}
