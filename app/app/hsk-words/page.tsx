"use client";

import { useEffect, useState } from "react";
import { Lock, Search, X } from "lucide-react";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import { createClient } from "@/lib/supabase/browser";
import { useIsHskAppPreview } from "@/components/hsk/hskFlashcardsPaths";
import { HSK_APP_LABELS } from "@/lib/hsk-app-labels";
import {
  DEFAULT_HSK_STANDARD,
  hskLevelOptions,
  hskMaxStoredLevel,
  parseHskStandard,
  type HskStandard,
} from "@/lib/utils/hsk";
import {
  HSK_STANDARD_COOKIE,
  parseHskStandardCookie,
} from "@/lib/hsk/standardPreference";

type WordStatus = "not_introduced" | "learning" | "due" | "mastered";

interface HskWord {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string;
  part_of_speech: string | null;
  example_sentence: string | null;
  example_pinyin: string | null;
  status: WordStatus;
}

interface Progress {
  total: number;
  mastered: number;
  due: number;
  learning: number;
}

const STATUS_STYLES: Record<WordStatus, string> = {
  mastered: "border-teal-300 bg-teal-50",
  due: "border-orange-300 bg-orange-50",
  learning: "border-blue-300 bg-blue-50",
  not_introduced: "border-gray-200 bg-gray-50",
};

const LEGEND: { status: WordStatus; label: string; dot: string }[] = [
  { status: "mastered", label: "Mastered", dot: "bg-teal-500" },
  { status: "due", label: "Due for review", dot: "bg-orange-500" },
  { status: "learning", label: "Learning now", dot: "bg-blue-600" },
  { status: "not_introduced", label: "Not yet introduced", dot: "bg-gray-300" },
];

export default function HskWordsPage() {
  const { convertText } = useCharacterSet();
  const isHskApp = useIsHskAppPreview();
  const [level, setLevel] = useState(1);
  const [targetLevel, setTargetLevel] = useState<number | null>(null);
  const [hskStandard, setHskStandard] = useState<HskStandard>(DEFAULT_HSK_STANDARD);
  const [words, setWords] = useState<HskWord[]>([]);
  const [total, setTotal] = useState(0);
  const [progress, setProgress] = useState<Progress>({
    total: 0,
    mastered: 0,
    due: 0,
    learning: 0,
  });
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedWord, setSelectedWord] = useState<HskWord | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data, error } = await supabase
        .from("user_profiles")
        .select("hsk_target_level, hsk_standard")
        .eq("user_id", user.id)
        .maybeSingle();
      const profile = error
        ? (
            await supabase
              .from("user_profiles")
              .select("hsk_target_level")
              .eq("user_id", user.id)
              .maybeSingle()
          ).data
        : data;
      if (typeof profile?.hsk_target_level === "number") {
        setTargetLevel(profile.hsk_target_level);
      }
      const cookieMatch =
        typeof document !== "undefined"
          ? document.cookie.match(
              new RegExp(`${HSK_STANDARD_COOKIE}=([^;]+)`),
            )
          : null;
      setHskStandard(
        parseHskStandard(
          (profile as { hsk_standard?: string } | null)?.hsk_standard ??
            parseHskStandardCookie(cookieMatch?.[1]),
        ),
      );
    });
  }, []);

  useEffect(() => {
    const max = hskMaxStoredLevel(hskStandard);
    if (level > max) setLevel(max);
  }, [hskStandard, level]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPage(0);
    const params = new URLSearchParams({ level: String(level), page: "0" });
    if (search) params.set("search", search);
    fetch(`/api/hsk/words?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setWords(data.words ?? []);
        setTotal(data.total ?? 0);
        setProgress(data.progress ?? { total: 0, mastered: 0, due: 0, learning: 0 });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, search]);

  const loadMore = async () => {
    setLoadingMore(true);
    const nextPage = page + 1;
    const params = new URLSearchParams({ level: String(level), page: String(nextPage) });
    if (search) params.set("search", search);
    try {
      const res = await fetch(`/api/hsk/words?${params.toString()}`);
      const data = await res.json();
      setWords((prev) => [...prev, ...(data.words ?? [])]);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  };

  const levels = hskLevelOptions(hskStandard);
  const progressPct = progress.total > 0 ? (progress.mastered / progress.total) * 100 : 0;
  const hasMore = words.length < total;

  const pageTitle = isHskApp ? HSK_APP_LABELS.vocabulary.title : "HSK Word Bank";
  const pageDescription = isHskApp
    ? HSK_APP_LABELS.vocabulary.description
    : "Browse every HSK word by level and track what you've mastered.";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
      <h1
        className={`mb-1 text-2xl text-gray-900 ${isHskApp ? "lingo-display text-[30px] text-[var(--lingo-navy)] sm:text-[34px]" : "font-black"}`}
      >
        {pageTitle}
      </h1>
      <p className={`mb-6 text-sm ${isHskApp ? "text-[var(--lingo-text-muted)]" : "text-gray-400"}`}>
        {pageDescription}
      </p>

      <div className="mb-6 flex gap-2 overflow-x-auto">
        {levels.map(({ level: lvl, label }) => {
          const locked = targetLevel != null && lvl > targetLevel && lvl < 7;
          return (
            <button
              key={lvl}
              onClick={() => setLevel(lvl)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                level === lvl
                  ? "bg-gray-900 text-white"
                  : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {label}
              {locked && <Lock className="h-3 w-3" aria-hidden />}
            </button>
          );
        })}
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
        <span>
          {progress.mastered} / {progress.total}{" "}
          {levels.find((item) => item.level === level)?.label ?? `HSK ${level}`} words
          mastered
        </span>
        <span>{Math.round(progressPct)}%</span>
      </div>
      <div className="mb-4 h-1.5 rounded-full bg-gray-100">
        <div
          className="h-1.5 rounded-full bg-teal-500 transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        {LEGEND.map((l) => (
          <div key={l.status} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className={`h-2.5 w-2.5 rounded-full ${l.dot}`} />
            {l.label}
          </div>
        ))}
      </div>

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search hanzi, pinyin, or English…"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : words.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">No words match your search.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {words.map((word) => (
              <button
                key={word.id}
                onClick={() => setSelectedWord(word)}
                className={`rounded-xl border px-3 py-4 text-center transition-colors hover:border-gray-400 ${STATUS_STYLES[word.status]}`}
              >
                <div className="text-xl font-black text-gray-900">
                  {convertText(word.hanzi)}
                </div>
                <div className="mt-1 truncate text-xs text-gray-500">{word.pinyin}</div>
                {word.english && (
                  <div className="mt-1 truncate text-[11px] text-gray-400">{word.english}</div>
                )}
              </button>
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
              >
                {loadingMore ? "Loading…" : `Load more (${words.length} of ${total})`}
              </button>
            </div>
          )}
        </>
      )}

      {selectedWord && (
        <WordDetailModal word={selectedWord} onClose={() => setSelectedWord(null)} />
      )}
    </div>
  );
}

function WordDetailModal({ word, onClose }: { word: HskWord; onClose: () => void }) {
  const { convertText } = useCharacterSet();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(word.status !== "not_introduced");

  const handleAdd = async () => {
    setAdding(true);
    try {
      const res = await fetch(`/api/hsk/words/${word.id}/flashcard`, { method: "POST" });
      if (res.ok) setAdded(true);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-1 text-4xl font-black text-gray-900">
          {convertText(word.hanzi)}
        </div>
        <div className="mb-3 text-sm text-gray-500">{word.pinyin}</div>
        {word.part_of_speech && (
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-teal-700">
            {word.part_of_speech}
          </div>
        )}
        <div className="mb-4 text-base font-semibold text-gray-900">
          {word.english || "Translation coming soon"}
        </div>

        {word.example_sentence && (
          <div className="mb-4 rounded-xl bg-gray-50 p-3">
            <div className="text-sm text-gray-800">{convertText(word.example_sentence)}</div>
            {word.example_pinyin && (
              <div className="mt-1 text-xs text-gray-400">{word.example_pinyin}</div>
            )}
          </div>
        )}

        <button
          onClick={handleAdd}
          disabled={adding || added}
          className="w-full rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-60"
        >
          {added ? "In your flashcards" : adding ? "Adding…" : "Add to flashcards"}
        </button>
      </div>
    </div>
  );
}
