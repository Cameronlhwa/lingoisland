"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Flame, Target, X, ChevronRight } from "lucide-react";
import {
  DAILY_MINUTES_OPTIONS,
  DEFAULT_DAILY_MINUTES,
  itemsForMinutes,
} from "@/lib/pronunciation/sessionSizing";
import { scoreTier, type WeakSoundRow } from "@/lib/pronunciation/weakSoundTypes";
import { guideForTone, weakSoundLabel } from "@/lib/pronunciation/soundGuides";
import { toneGlyph } from "@/lib/pronunciation/encouragement";
import AppPageLoading from "@/components/app/AppPageLoading";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCharacterSet } from "@/contexts/CharacterSetContext";

type Profile = {
  streak_count: number;
  overall_score: number | null;
  daily_minutes: number | null;
  diagnostic_completed_at: string | null;
};

type HistoryItem = {
  id: string;
  source: string;
  completedAt: string | null;
  itemCount: number;
  avgScore: number | null;
};

type TrendPoint = { date: string; avgScore: number };
type DayActivity = { date: string; practiced: boolean };

type Baseline = {
  completed: boolean;
  score: number | null;
  day1Count: number;
  day1Total: number;
  partialDay1: boolean;
  remeasureCount: number;
  remeasureTotal: number;
  partialRemeasure: boolean;
  remeasureScore: number | null;
  progressCheckSuggested: boolean;
};

type Stats = {
  profile: Profile | null;
  history: HistoryItem[];
  trend: TrendPoint[];
  weeklyActivity: DayActivity[];
  totals: { sessions: number; sentences: number };
  practicedToday: boolean;
  baseline: Baseline;
};

function sourceLabel(source: string, t: (key: string) => string) {
  if (source === "weak_sounds_focus") return t("Weak sounds");
  if (source === "journey_node") return t("Journey checkpoint");
  return t("General practice");
}

function formatDay(iso: string | null, t: (key: string) => string) {
  if (!iso) return "";
  const d = new Date(iso);
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return t("Today");
  if (diffDays === 1) return t("Yesterday");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const WEEKDAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_FOCUS_SOUNDS = 6;

function WeakSoundPracticeModal({
  weakSounds,
  selectedIds,
  onToggle,
  onCancel,
  onStart,
  starting,
  error,
}: {
  weakSounds: WeakSoundRow[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onCancel: () => void;
  onStart: () => void;
  starting: boolean;
  error: string | null;
}) {
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onCancel}>
      <div
        className="flex max-h-[85vh] w-full flex-col rounded-t-[28px] bg-white sm:max-w-md sm:rounded-[28px]"
        style={{ boxShadow: "var(--lingo-shadow-card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b p-5" style={{ borderColor: "var(--lingo-border)" }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "#92400e" }}>
              {convertText(t("Focused practice"))}
            </p>
            <h2 className="lingo-display mt-0.5 text-lg text-(--lingo-navy)">{convertText(t("Choose sounds to practice"))}</h2>
          </div>
          <button type="button" onClick={onCancel} className="rounded-full p-1.5 text-(--lingo-text-muted) hover:bg-(--lingo-sky-pale)">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex flex-col gap-2">
            {weakSounds.map((w) => {
              const selected = selectedIds.has(w.id);
              const tier = scoreTier(w.last_score);
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => onToggle(w.id)}
                  className={`flex items-center justify-between gap-3 rounded-2xl border-2 p-3 text-left transition ${
                    selected ? "border-(--lingo-blue)" : "border-transparent"
                  }`}
                  style={{ background: selected ? "var(--lingo-sky-pale)" : "#f8fafb" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="lingo-display flex h-10 w-10 items-center justify-center rounded-xl text-base"
                      style={{ background: tier.bg, color: tier.text, border: `1px solid ${tier.border}` }}
                    >
                      {convertText(w.syllable)}
                    </span>
                    <div>
                      <p className="text-sm font-bold text-(--lingo-navy)">
                        {w.pinyin ?? convertText(w.syllable)} {toneGlyph(w.target_tone)}
                      </p>
                      <p className="text-xs text-(--lingo-text-muted)">
                        {w.consecutive_good > 0
                          ? `${w.consecutive_good} ${convertText(t("good in a row"))}`
                          : `${convertText(t("Missed"))} ${w.times_wrong}×`}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      selected ? "border-(--lingo-blue) bg-(--lingo-blue) text-white" : "border-gray-300"
                    }`}
                  >
                    {selected ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
        <div className="border-t p-4" style={{ borderColor: "var(--lingo-border)" }}>
          <button
            type="button"
            disabled={starting || selectedIds.size === 0}
            onClick={onStart}
            className="w-full rounded-2xl px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "var(--lingo-accent-gradient)" }}
          >
            {starting
              ? convertText(t("Preparing"))
              : `${convertText(t("Practice"))} ${selectedIds.size} ${convertText(t(selectedIds.size === 1 ? "sound" : "sounds"))} →`}
          </button>
        </div>
      </div>
    </div>
  );
}

function SoftTrend({ points }: { points: TrendPoint[] }) {
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();
  if (points.length < 2) {
    return (
      <p className="py-6 text-sm text-(--lingo-text-muted)">
        {convertText(t("Your progress will appear here after a few practice sessions."))}
      </p>
    );
  }
  const scores = points.map((p) => p.avgScore);
  const min = Math.min(...scores, 40);
  const max = Math.max(...scores, 100);
  const range = Math.max(max - min, 1);
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * 300;
    const y = 88 - ((p.avgScore - min) / range) * 70;
    return { x, y, score: p.avgScore };
  });
  const line = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} 300,100 0,100`;
  const first = coords[0];
  const last = coords[coords.length - 1];

  return (
    <div>
      <svg viewBox="0 0 300 100" className="w-full" style={{ height: 110 }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="pronTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--lingo-teal)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--lingo-teal)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#pronTrendFill)" />
        <polyline points={line} fill="none" stroke="var(--lingo-teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={i === coords.length - 1 ? 5 : 3} fill="var(--lingo-teal)" stroke="#fff" strokeWidth="2" />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-(--lingo-text-muted)">
        <span>{convertText(t("First"))} · {Math.round(first.score)}</span>
        <span>{convertText(t("Latest"))} · {Math.round(last.score)}</span>
      </div>
    </div>
  );
}

export default function PronunciationHubPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [weakSounds, setWeakSounds] = useState<WeakSoundRow[]>([]);
  const [starting, setStarting] = useState<"general" | "focus" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focusModalOpen, setFocusModalOpen] = useState(false);
  const [focusSelectedIds, setFocusSelectedIds] = useState<Set<string>>(new Set());
  const [focusError, setFocusError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [statsRes, weakRes] = await Promise.all([
      fetch("/api/pronunciation/stats", { cache: "no-store" }),
      fetch("/api/pronunciation/weak-sounds", { cache: "no-store" }),
    ]);
    const statsData = await statsRes.json().catch(() => null);
    if (statsRes.ok && statsData) setStats(statsData);
    const weakData = await weakRes.json().catch(() => null);
    if (weakRes.ok && weakData) setWeakSounds(weakData.weakSounds ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const profile = stats?.profile ?? null;
  const baseline = stats?.baseline;
  const dailyMinutes = profile?.daily_minutes ?? DEFAULT_DAILY_MINUTES;
  const itemCount = itemsForMinutes(dailyMinutes);
  const topWeak = weakSounds.slice(0, 5);
  const needsBaseline = !baseline?.completed;
  const practicedToday = !!stats?.practicedToday;

  const headline = (() => {
    if (needsBaseline) return t("Let's hear how you sound.");
    if (topWeak.length > 0) return t("Let's smooth out a few tricky sounds.");
    if (baseline?.remeasureScore != null && baseline.score != null && baseline.remeasureScore > baseline.score) {
      return t("You're sounding clearer already.");
    }
    return t("Ready for today's practice?");
  })();

  const startPractice = async (mode: "general" | "focus", weakSoundIds?: string[]) => {
    setStarting(mode);
    setError(null);
    try {
      const endpoint = mode === "focus" ? "/api/pronunciation/session/focus" : "/api/pronunciation/session";
      const res = await fetch(endpoint, {
        method: "POST",
        ...(weakSoundIds
          ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weakSoundIds }) }
          : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.sessionId) {
        throw new Error(typeof data?.error === "string" ? data.error : "Unable to start practice.");
      }
      router.push(`/app/pronunciation/session/${data.sessionId}`);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to start practice.";
      if (mode === "focus" && weakSoundIds) setFocusError(message);
      else setError(message);
      setStarting(null);
    }
  };

  const openFocusModal = () => {
    setFocusError(null);
    setFocusSelectedIds(new Set(weakSounds.slice(0, MAX_FOCUS_SOUNDS).map((w) => w.id)));
    setFocusModalOpen(true);
  };

  const toggleFocusSound = (id: string) => {
    setFocusSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_FOCUS_SOUNDS) next.add(id);
      return next;
    });
  };

  const changeDailyMinutes = async (minutes: number) => {
    setPickerOpen(false);
    setStats((prev) =>
      prev
        ? {
            ...prev,
            profile: {
              streak_count: prev.profile?.streak_count ?? 0,
              overall_score: prev.profile?.overall_score ?? null,
              daily_minutes: minutes,
              diagnostic_completed_at: prev.profile?.diagnostic_completed_at ?? null,
            },
          }
        : prev,
    );
    await fetch("/api/pronunciation/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyMinutes: minutes }),
    }).catch(() => {});
  };

  const weekSessions = stats?.weeklyActivity.filter((d) => d.practiced).length ?? 0;
  const firstTrend = stats?.trend[0]?.avgScore ?? null;
  const lastTrend = stats?.trend.length ? stats.trend[stats.trend.length - 1]?.avgScore ?? null : null;
  const trendDelta =
    firstTrend != null && lastTrend != null ? Math.round(lastTrend - firstTrend) : null;
  const baselineDelta =
    baseline?.score != null && typeof profile?.overall_score === "number"
      ? Math.round(profile.overall_score - baseline.score)
      : baseline?.score != null && baseline.remeasureScore != null
        ? Math.round(baseline.remeasureScore - baseline.score)
        : null;

  if (loading) {
    return <AppPageLoading />;
  }

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-8 md:px-6">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-(--lingo-blue)">{convertText(t("Pronunciation"))}</p>
          <h1 className="lingo-display mt-1 max-w-xl text-3xl font-bold text-(--lingo-navy) sm:text-4xl">{convertText(headline)}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {!!profile?.streak_count && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-(--lingo-navy) px-3 py-1.5 text-xs font-bold text-white">
              <Flame size={13} className="text-amber-400" /> {profile.streak_count}{convertText(t("-day streak"))}
            </span>
          )}
          {typeof profile?.overall_score === "number" && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
              style={{ background: "#e7f7f5", color: "#0f766e", border: "1px solid #99f6e4" }}
            >
              {convertText(t("Score"))} {Math.round(profile.overall_score)}
            </span>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* Hero */}
      <div
        className="relative mb-5 flex min-h-0 flex-col overflow-hidden rounded-[32px] sm:min-h-[220px] sm:flex-row"
        style={{ background: "var(--lingo-accent-gradient)", boxShadow: "0 18px 50px rgba(33,118,174,.22)" }}
      >
        <div className="relative z-10 flex w-full flex-col justify-center px-6 py-7 sm:w-[62%] sm:px-9 sm:py-8">
          {needsBaseline ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/75">{convertText(t("Pronunciation check"))}</p>
              <h2 className="lingo-display mt-2 text-2xl text-white sm:text-3xl">{convertText(t("Let's hear how you sound"))}</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-white/90">
                {convertText(t("Read a few sentences out loud. We'll use them to figure out which sounds to focus on."))}
                {baseline?.partialDay1
                  ? ` ${convertText(t("Resume where you left off"))} (${baseline.day1Count}/${baseline.day1Total}).`
                  : ` ${convertText(t("About 2 minutes."))}`}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link
                  href="/app/pronunciation/diagnostic"
                  className="inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-bold text-(--lingo-navy) shadow-xs"
                >
                  {convertText(t(baseline?.partialDay1 ? "Continue check →" : "Start pronunciation check →"))}
                </Link>
                <button
                  type="button"
                  disabled={starting === "general"}
                  onClick={() => void startPractice("general")}
                  className="text-sm font-semibold text-white/90 underline-offset-2 hover:underline"
                >
                  {convertText(t("Skip for now, I'll just practice"))}
                </button>
              </div>
            </>
          ) : practicedToday ? (
            <>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/75">{convertText(t("Today's practice"))}</p>
              <h2 className="lingo-display mt-2 text-2xl text-white sm:text-3xl">{convertText(t("Today's practice complete!"))}</h2>
              <p className="mt-2 max-w-md text-sm text-white/90">
                {convertText(t("Nice work — you trained today. Come back tomorrow to keep the streak, or practice a little more."))}
              </p>
              <button
                type="button"
                disabled={starting === "general"}
                onClick={() => void startPractice("general")}
                className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-bold text-(--lingo-navy) shadow-xs disabled:opacity-60"
              >
                {convertText(t(starting === "general" ? "Preparing" : "Practice a little more →"))}
              </button>
            </>
          ) : (
            <>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/75">{convertText(t("Today's practice"))}</p>
              <h2 className="lingo-display mt-2 text-2xl text-white sm:text-3xl">
                {itemCount} {convertText(t("sentences, built for your ear"))}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-white/90">
                {convertText(t("Word, then sentence, then the tricky syllable if you need it — sized to your day."))}
              </p>
              <div className="relative mt-5 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-xs font-bold text-white">
                  ~{dailyMinutes} {convertText(t("min"))}
                </span>
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  className="rounded-full border border-white/40 px-3 py-1.5 text-xs font-bold text-white"
                >
                  {dailyMinutes} {convertText(t("min/day · Change"))}
                </button>
                {pickerOpen && (
                  <div className="absolute left-0 top-full z-20 mt-2 flex flex-wrap gap-1.5 rounded-2xl bg-white p-2 shadow-xl">
                    {DAILY_MINUTES_OPTIONS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => void changeDailyMinutes(m)}
                        className={`rounded-xl px-3 py-2 text-xs font-bold ${
                          m === dailyMinutes ? "bg-(--lingo-navy) text-white" : "text-(--lingo-navy) hover:bg-(--lingo-sky-pale)"
                        }`}
                      >
                        {m} {convertText(t("min"))}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={starting === "general"}
                onClick={() => void startPractice("general")}
                className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-bold text-(--lingo-navy) shadow-xs disabled:opacity-60"
              >
                {convertText(t(starting === "general" ? "Preparing" : "Start today's practice →"))}
              </button>
            </>
          )}
        </div>

        <div className="relative h-[180px] w-full shrink-0 sm:h-auto sm:w-[38%]">
          <Image
            src={
              needsBaseline
                ? "/pronunciation/pronunciation-check-hero.png"
                : practicedToday
                  ? "/pronunciation/huahua-celebrating.png"
                  : "/pronunciation/pronunciation-check-hero.png"
            }
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 100vw, 38vw"
            className="object-cover object-center"
          />
          <div
            className="pointer-events-none absolute inset-y-0 left-0 hidden w-16 sm:block"
            style={{ background: "linear-gradient(90deg, rgba(53,168,200,0.95) 0%, rgba(53,168,200,0) 100%)" }}
          />
        </div>
      </div>

      {/* Two action cards — landscape art as full-bleed background */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div
          className="relative min-h-[200px] overflow-hidden rounded-[28px] border bg-white sm:min-h-[176px]"
          style={{ borderColor: "var(--lingo-border)", boxShadow: "var(--lingo-shadow-card)" }}
        >
          <Image
            src="/pronunciation/pronunciation-weak-spots-wide.jpg"
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover object-[70%_center]"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.90) 32%, rgba(255,255,255,0.62) 48%, rgba(255,255,255,0.22) 64%, rgba(255,255,255,0) 80%)",
            }}
          />
          <div className="relative z-10 flex h-full min-h-[200px] w-full flex-col justify-center p-5 sm:min-h-[176px] sm:w-[58%] sm:p-6">
            {topWeak.length > 0 ? (
              <>
                <h3 className="lingo-display text-xl font-bold text-(--lingo-navy)">{convertText(t("Work on your weaknesses"))}</h3>
                <p className="mt-1 text-sm text-(--lingo-text-muted)">{convertText(t("You've been struggling most with:"))}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {topWeak.slice(0, 3).map((w) => {
                    const tier = scoreTier(w.last_score);
                    const label = guideForTone(w.target_tone)?.title ?? w.pinyin ?? w.syllable;
                    return (
                      <span
                        key={w.id}
                        className="rounded-full px-3 py-1 text-xs font-bold"
                        style={{ background: tier.bg, color: tier.text, border: `1px solid ${tier.border}` }}
                      >
                        {convertText(w.syllable)} · {label}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-3 text-sm text-(--lingo-text)">
                  {convertText(t("We'll build a short session around the sounds that need the most attention."))}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={starting === "focus"}
                    onClick={() => void startPractice("focus")}
                    className="rounded-2xl bg-(--lingo-navy) px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {convertText(t(starting === "focus" ? "Preparing" : "Practice weak sounds →"))}
                  </button>
                  <button type="button" onClick={openFocusModal} className="text-sm font-semibold text-(--lingo-blue)">
                    {convertText(t("Choose sounds"))}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="lingo-display text-xl font-bold text-(--lingo-navy)">{convertText(t("Find your weak spots"))}</h3>
                <p className="mt-2 text-sm text-(--lingo-text-muted)">
                  {convertText(t("Practice a few sentences and Huahua will learn which sounds need more attention."))}
                </p>
                <button
                  type="button"
                  disabled={starting === "general"}
                  onClick={() => void startPractice("general")}
                  className="mt-5 w-fit rounded-2xl bg-(--lingo-navy) px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
                >
                  {convertText(t("Start practice →"))}
                </button>
              </>
            )}
          </div>
        </div>

        <div
          className="relative min-h-[200px] overflow-hidden rounded-[28px] border bg-white sm:min-h-[176px]"
          style={{ borderColor: "var(--lingo-border)", boxShadow: "var(--lingo-shadow-card)" }}
        >
          <Image
            src="/pronunciation/pronunciation-progress-wide.jpg"
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover object-[62%_center]"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.90) 32%, rgba(255,252,248,0.58) 48%, rgba(255,255,255,0.18) 64%, rgba(255,255,255,0) 80%)",
            }}
          />
          <div className="relative z-10 flex h-full min-h-[200px] w-full flex-col justify-center p-5 sm:min-h-[176px] sm:w-[58%] sm:p-6">
            {baseline?.partialRemeasure ? (
              <>
                <h3 className="lingo-display text-xl font-bold text-(--lingo-navy)">{convertText(t("Progress check in progress"))}</h3>
                <p className="mt-2 text-sm text-(--lingo-text-muted)">
                  {baseline.remeasureCount}/{baseline.remeasureTotal} {convertText(t("sentences"))} {convertText(t("done"))}
                </p>
                <Link
                  href="/app/pronunciation/remeasure"
                  className="mt-5 inline-flex w-fit rounded-2xl bg-(--lingo-navy) px-4 py-2.5 text-sm font-bold text-white"
                >
                  {convertText(t("Continue check →"))}
                </Link>
              </>
            ) : baseline?.completed ? (
              <>
                <h3 className="lingo-display text-xl font-bold text-(--lingo-navy)">{convertText(t("Check your progress"))}</h3>
                <p className="mt-2 text-sm text-(--lingo-text)">
                  {baseline.score != null && (
                    <span className="mr-3 font-semibold text-(--lingo-navy)">{convertText(t("Last check:"))} {Math.round(baseline.score)}</span>
                  )}
                  {typeof profile?.overall_score === "number" && (
                    <span className="font-semibold text-(--lingo-navy)">
                      {convertText(t("Practice score:"))} {Math.round(profile.overall_score)}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-(--lingo-text-muted)">{convertText(t("See how your pronunciation has changed."))}</p>
                <Link
                  href="/app/pronunciation/remeasure"
                  className="mt-5 inline-flex w-fit rounded-2xl bg-(--lingo-navy) px-4 py-2.5 text-sm font-bold text-white"
                >
                  {convertText(t(baseline.progressCheckSuggested ? "Take a progress check →" : "Remeasure anytime →"))}
                </Link>
              </>
            ) : (
              <>
                <h3 className="lingo-display text-xl font-bold text-(--lingo-navy)">{convertText(t("Create your pronunciation baseline"))}</h3>
                <p className="mt-2 text-sm text-(--lingo-text-muted)">
                  {convertText(t("A quick check gives us a starting point so we can show you exactly how you improve."))}
                </p>
                <Link
                  href="/app/pronunciation/diagnostic"
                  className="mt-5 inline-flex w-fit rounded-2xl bg-(--lingo-navy) px-4 py-2.5 text-sm font-bold text-white"
                >
                  {convertText(t("Take the 2-minute check →"))}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Your pronunciation */}
      <section className="mb-8">
        <h2 className="lingo-display text-xl font-bold text-(--lingo-navy)">{convertText(t("Your pronunciation"))}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div
            className="rounded-[28px] border bg-white p-6"
            style={{ borderColor: "var(--lingo-border)", boxShadow: "var(--lingo-shadow-card)" }}
          >
            <h3 className="text-sm font-bold text-(--lingo-navy)">{convertText(t("You're getting clearer"))}</h3>
            {typeof profile?.overall_score === "number" ? (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                {baseline?.score != null && (
                  <span className="text-2xl font-bold text-(--lingo-text-muted)">{Math.round(baseline.score)}</span>
                )}
                {baseline?.score != null && <span className="pb-1 text-(--lingo-text-muted)">→</span>}
                <span className="lingo-display text-4xl font-bold text-(--lingo-navy)">
                  {Math.round(profile.overall_score)}
                </span>
                {baselineDelta != null && baselineDelta !== 0 && (
                  <span
                    className="mb-1 rounded-full px-2.5 py-1 text-xs font-bold"
                    style={{
                      background: baselineDelta > 0 ? "#e7f7f5" : "#fdecea",
                      color: baselineDelta > 0 ? "#0f766e" : "#9f1c14",
                    }}
                  >
                    {baselineDelta > 0 ? "+" : ""}
                    {baselineDelta} {convertText(t("since first check"))}
                  </span>
                )}
                {baselineDelta == null && trendDelta != null && trendDelta !== 0 && (
                  <span className="mb-1 text-xs font-semibold text-(--lingo-text-muted)">
                    {trendDelta > 0 ? "+" : ""}
                    {trendDelta} {convertText(t("across recent sessions"))}
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-(--lingo-text-muted)">
                {convertText(t("Complete a check or a practice session to see your score here."))}
              </p>
            )}
            <div className="mt-4">
              <SoftTrend points={stats?.trend ?? []} />
            </div>
          </div>

          <div
            className="rounded-[28px] border bg-white p-6"
            style={{ borderColor: "var(--lingo-border)", boxShadow: "var(--lingo-shadow-card)" }}
          >
            <h3 className="text-sm font-bold text-(--lingo-navy)">{convertText(t("This week's practice"))}</h3>
            <div className="mt-4 flex justify-between gap-1">
              {(stats?.weeklyActivity ?? []).map((day, i) => (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[10px] font-bold text-(--lingo-text-muted)">{convertText(t(WEEKDAY_KEYS[i]))}</span>
                  <span
                    className="h-8 w-8 rounded-full"
                    style={{
                      background: day.practiced ? "var(--lingo-teal)" : "var(--lingo-sky-pale)",
                      boxShadow: day.practiced ? "0 0 0 3px rgba(66,185,180,.25)" : undefined,
                    }}
                  />
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm text-(--lingo-text-muted)">
              <span className="font-bold text-(--lingo-navy)">{weekSessions}</span> {convertText(t("days"))} ·{" "}
              <span className="font-bold text-(--lingo-navy)">{stats?.totals.sentences ?? 0}</span> {convertText(t("sentences all-time"))}
            </p>
          </div>
        </div>
      </section>

      {/* Sounds we're working on */}
      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="lingo-display text-xl font-bold text-(--lingo-navy)">{convertText(t("Sounds we're working on"))}</h2>
            <p className="mt-1 text-sm text-(--lingo-text-muted)">
              {convertText(t("These are the sounds Huahua is paying extra attention to."))}
            </p>
          </div>
          <Link href="/app/pronunciation/review" className="text-sm font-bold text-(--lingo-blue)">
            {convertText(t("See all weak sounds →"))}
          </Link>
        </div>
        {topWeak.length === 0 ? (
          <div
            className="rounded-[24px] border bg-white px-6 py-8 text-center text-sm text-(--lingo-text-muted)"
            style={{ borderColor: "var(--lingo-border)" }}
          >
            {convertText(t("Nothing flagged yet — keep practicing and patterns will show up here."))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topWeak.map((w) => {
              const tier = scoreTier(w.last_score);
              const improving = w.consecutive_good >= 1;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => void startPractice("focus", [w.id])}
                  className="rounded-[22px] border bg-white p-4 text-left transition hover:-translate-y-0.5"
                  style={{ borderColor: "var(--lingo-border)", boxShadow: "var(--lingo-shadow-card)" }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="lingo-display flex h-12 w-12 items-center justify-center rounded-2xl text-lg"
                      style={{ background: tier.bg, color: tier.text, border: `1px solid ${tier.border}` }}
                    >
                      {convertText(w.syllable)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-(--lingo-navy)">
                        {convertText(weakSoundLabel(w.syllable, w.pinyin, w.target_tone))}
                      </p>
                      <p className="text-xs font-semibold" style={{ color: improving ? "#0f766e" : "#92400e" }}>
                        {convertText(t(improving ? "Getting better" : "Needs practice"))}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-(--lingo-text-muted)">
                    {w.consecutive_good > 0
                      ? `${w.consecutive_good} ${convertText(t(w.consecutive_good === 1 ? "good attempt in a row" : "good attempts in a row"))}`
                      : `${convertText(t("Missed"))} ${w.times_wrong} ${convertText(t("of"))} ${w.times_seen}`}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent */}
      <section>
        <h2 className="lingo-display text-lg font-bold text-(--lingo-navy)">{convertText(t("Recent practice"))}</h2>
        {(stats?.history.length ?? 0) === 0 ? (
          <p className="mt-3 text-sm text-(--lingo-text-muted)">{convertText(t("No sessions yet."))}</p>
        ) : (
          <div className="mt-3 divide-y rounded-[22px] border bg-white" style={{ borderColor: "var(--lingo-border)" }}>
            {stats!.history.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3.5">
                <div>
                  <p className="text-sm font-bold text-(--lingo-navy)">{convertText(sourceLabel(item.source, t))}</p>
                  <p className="text-xs text-(--lingo-text-muted)">
                    {convertText(formatDay(item.completedAt, t))} · {item.itemCount} {convertText(t("sentences"))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="lingo-display text-lg font-bold text-(--lingo-navy)">
                    {item.avgScore == null ? "—" : Math.round(item.avgScore)}
                  </span>
                  <ChevronRight size={16} className="text-(--lingo-text-muted)" />
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-center text-xs text-(--lingo-text-muted)">
          {convertText(t("Topics come from your"))}{" "}
          <Link href="/app/journey" className="font-semibold text-(--lingo-blue)">
            {convertText(t("Journeys"))}
          </Link>
          .
        </p>
      </section>

      {focusModalOpen && (
        <WeakSoundPracticeModal
          weakSounds={weakSounds}
          selectedIds={focusSelectedIds}
          onToggle={toggleFocusSound}
          onCancel={() => setFocusModalOpen(false)}
          onStart={() => void startPractice("focus", Array.from(focusSelectedIds))}
          starting={starting === "focus"}
          error={focusError}
        />
      )}
    </div>
  );
}
