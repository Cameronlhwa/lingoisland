"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import type { DailyStorySummary } from "@/components/stories/DailyStoryCard";
import JourneyHero from "@/components/app/JourneyHero";
import { getLocalDateKey } from "@/lib/utils/date";
import { useSidebar } from "@/components/app/AppLayoutClient";
import UpgradeModal from "@/components/app/UpgradeModal";
import { useSubscription } from "@/hooks/useSubscription";
import { STAGE_THRESHOLDS } from "@/lib/huahua";

// ─── Types (unchanged) ────────────────────────────────────────────────────────

interface TopicIsland {
  id: string;
  topic: string;
  level: string;
  word_target: number;
  status: string;
  created_at: string;
}

interface QuizCardSummary {
  reviewState?: {
    dueAt?: string | null;
  } | null;
}

interface QuizIslandSummary {
  id: string;
  name: string;
  card_count: number;
}

interface FlashcardDeckCard extends QuizIslandSummary {
  dueCount: number;
  totalCount: number;
  statusLabel: string;
  progressPercent: number;
}

interface QuizStatsRow {
  forgot_count: number;
  hard_count: number;
  good_count: number;
  easy_count: number;
  new_count: number;
  total_count: number;
}

const STORAGE_KEY = "pending_topic_island_request";

// ─── Capybara constants ────────────────────────────────────────────────────────

const STAGE_NAMES = ["Bare Island", "Foundation", "Village", "Town", "Thriving City"];
const STAGE_EMOJIS = ["🏜️", "🏗️", "🏘️", "🏙️", "🌆"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function TopBar({
  streakDays,
  wordsLearned,
  dueCount,
  stage,
}: {
  streakDays: number;
  wordsLearned: number;
  dueCount: number;
  stage: number;
}) {
  const safeStage = Math.min(5, Math.max(1, stage || 1));
  const stageName = STAGE_NAMES[safeStage - 1];

  return (
    <div className="sticky top-0 z-30 flex h-[52px] items-center justify-between border-b border-slate-100 bg-white px-6">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-600">
          🔥 {streakDays} day streak
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {wordsLearned} words learned
        </span>
        {dueCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            {dueCount} due
          </span>
        )}
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
        🦫 华华 · Stage {safeStage} · {stageName}
      </span>
    </div>
  );
}

function CapybaraCard({
  stage,
  totalReviews,
}: {
  stage: number;
  totalReviews: number;
}) {
  const safeStage = Math.min(5, Math.max(1, stage || 1));
  const prevThreshold = STAGE_THRESHOLDS[safeStage - 1] ?? 0;
  const nextThreshold = safeStage < 5 ? STAGE_THRESHOLDS[safeStage] : null;
  const stageRange = nextThreshold ? nextThreshold - prevThreshold : 10;
  const stageProgress = nextThreshold
    ? Math.min(100, ((totalReviews - prevThreshold) / stageRange) * 100)
    : 100;
  const reviewsUntilNext = nextThreshold
    ? Math.max(0, nextThreshold - totalReviews)
    : 0;
  const isComplete = safeStage === 5;
  const stageName = STAGE_NAMES[safeStage - 1];
  const stageEmoji = STAGE_EMOJIS[safeStage - 1];

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#c8dce6]" style={{ background: "#e8f3f8" }}>
      {/* Art area */}
      <div className="flex h-[200px] items-center justify-center border-b border-[#c8dce6] px-2" style={{ background: "#d5ebf6" }}>
        <div className="relative h-[188px] w-full">
          <Image
            src={`/progress-islands/stage-${safeStage}.png`}
            alt={`华华's island — Stage ${safeStage}`}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 320px"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          华华's Island
        </p>
        <p className="mt-1 text-sm font-black text-slate-900">
          Stage {safeStage} · {stageName}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          {isComplete ? "Island complete 🎉" : `Currently: ${stageEmoji} ${stageName}`}
        </p>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-900 transition-all duration-500"
              style={{ width: `${stageProgress}%` }}
            />
          </div>
          {!isComplete && (
            <p className="mt-1.5 text-[10px] text-slate-400">
              {reviewsUntilNext} more card{reviewsUntilNext !== 1 ? "s" : ""} to Stage {safeStage + 1}
            </p>
          )}
        </div>

        <Link
          href="/app/quiz"
          className="mt-auto rounded-xl bg-slate-900 px-4 py-2 text-center text-xs font-bold text-white transition-colors hover:bg-slate-800"
        >
          Review cards →
        </Link>
      </div>
    </div>
  );
}

function HomeDailyStoryCard({
  story,
  loading,
}: {
  story: DailyStorySummary | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-col overflow-hidden rounded-2xl border border-[#c8dce6]" style={{ background: "#e8f3f8" }}>
        <div className="flex h-[200px] items-center justify-center border-b border-[#c8dce6]" style={{ background: "#d5ebf6" }}>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-500" />
        </div>
        <div className="flex flex-1 flex-col p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Daily Story</p>
          <p className="mt-2 text-xs text-slate-400">Generating today's story…</p>
        </div>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="flex flex-col overflow-hidden rounded-2xl border border-[#c8dce6]" style={{ background: "#e8f3f8" }}>
        <div className="flex h-[200px] items-center justify-center border-b border-[#c8dce6]" style={{ background: "#d5ebf6" }}>
          <span className="text-4xl">📖</span>
        </div>
        <div className="flex flex-1 flex-col p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Daily Story</p>
          <p className="mt-2 text-xs text-slate-400">No story today yet.</p>
          <Link
            href="/app/story/daily"
            className="mt-auto rounded-xl bg-slate-900 px-4 py-2 text-center text-xs font-bold text-white transition-colors hover:bg-slate-800"
          >
            Generate story →
          </Link>
        </div>
      </div>
    );
  }

  const level = (story as any).level as string | undefined;
  const lengthChars = (story as any).length_chars as number | undefined;
  const storyZh = (story as any).story_zh as string | undefined;
  const storyId = (story as any).id as string | undefined;
  const title = (story as any).title as string | undefined;
  const titleEn = (story as any).title_en as string | null | undefined;

  const readMins = lengthChars ? Math.max(1, Math.ceil(lengthChars / 200)) : 2;
  const excerpt = storyZh ? storyZh.slice(0, 80) + (storyZh.length > 80 ? "…" : "") : "";

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#c8dce6]" style={{ background: "#e8f3f8" }}>
      {/* Header area */}
      <div className="flex h-[200px] flex-col justify-end border-b border-[#c8dce6] p-4" style={{ background: "#d5ebf6" }}>
        <div className="mb-2 flex items-center gap-2">
          {level && (
            <span className="rounded-full border border-[#b5d4e8] bg-white/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {level}
            </span>
          )}
          <span className="rounded-full border border-[#b5d4e8] bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
            ~{readMins} min
          </span>
        </div>
        <p className="line-clamp-1 text-base font-black leading-tight text-slate-900">
          {title ?? "今日故事"}
        </p>
        {titleEn && (
          <p className="mt-0.5 line-clamp-1 text-[11px] font-medium leading-tight text-slate-500">
            {titleEn}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Daily Story · Today
        </p>
        {excerpt && (
          <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-500">
            {excerpt}
          </p>
        )}
        <Link
          href={storyId ? `/app/story/${storyId}` : "/app/story/daily"}
          className="mt-auto rounded-xl bg-slate-900 px-4 py-2 text-center text-xs font-bold text-white transition-colors hover:bg-slate-800"
        >
          Read story →
        </Link>
      </div>
    </div>
  );
}

function CreateIslandDashCard() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#c8dce6]" style={{ background: "#e8f3f8" }}>
      {/* Art area */}
      <div className="flex h-[200px] flex-col items-center justify-center border-b border-[#c8dce6]" style={{ background: "#d5ebf6" }}>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: "rgba(74,159,196,0.15)" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4a9fc4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
        </div>
        <p className="mt-2.5 text-xs font-semibold text-slate-500">New island</p>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Topic Islands
        </p>
        <p className="mt-1 text-sm font-black text-slate-900">
          Create a specialized island
        </p>
        <p className="mt-0.5 text-xs text-slate-400">
          Pick any topic and get vocab + examples tailored to your level.
        </p>
        <div className="mt-auto flex flex-col gap-2">
          <Link
            href="/app/topic-islands?create=1"
            className="rounded-xl bg-slate-900 px-4 py-2 text-center text-xs font-bold text-white transition-colors hover:bg-slate-800"
          >
            Create island →
          </Link>
          <Link
            href="/app/browse-topics"
            className="rounded-xl border border-[#c8dce6] bg-white px-4 py-2 text-center text-xs font-bold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50"
          >
            Browse topics →
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function HomeDashboard({
  dailyStory,
}: {
  dailyStory: DailyStorySummary | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();
  const [topicIslands, setTopicIslands] = useState<TopicIsland[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyStoryLocal, setDailyStoryLocal] =
    useState<DailyStorySummary | null>(dailyStory);
  const [dailyLoading, setDailyLoading] = useState(false);
  const dailyHasTriedRef = useRef(false);
  const [dueCardCount, setDueCardCount] = useState(0);
  const [flashcardsLoading, setFlashcardsLoading] = useState(true);
  const [todayReviewCount, setTodayReviewCount] = useState(0);
  const [islandLoading, setIslandLoading] = useState(true);
  const [flashcardDecks, setFlashcardDecks] = useState<QuizIslandSummary[]>([]);
  const [quizStatsByIsland, setQuizStatsByIsland] = useState<
    Record<string, QuizStatsRow>
  >({});
  const [last7DaysActivity, setLast7DaysActivity] = useState<
    { date: string; count: number }[]
  >([]);
  const [totalWordsLearned, setTotalWordsLearned] = useState(0);
  const [activeJourney, setActiveJourney] = useState<{
    id: string;
    topic: string;
    words_per_week: number | null;
    completed_at: string | null;
  } | null>(null);
  const [activeJourneyNodes, setActiveJourneyNodes] = useState<
    Array<{
      id: string;
      order: number;
      position: number;
      node_type: "island" | "story";
      name: string;
      hint: string | null;
      word_count: number | null;
      completed_at: string | null;
      island_id: string | null;
    }>
  >([]);
  const [huahuaStage, setHuahuaStage] = useState(1);
  const [huahuaTotalReviews, setHuahuaTotalReviews] = useState(0);
  const [firstName, setFirstName] = useState("there");
  const { isAnonymous, openSignupModal } = useSidebar();
  const { isPro } = useSubscription();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeatureHint, setUpgradeFeatureHint] = useState<string | undefined>(undefined);
  const islandsScrollRef = useRef<HTMLDivElement | null>(null);
  const flashcardsScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDailyStoryLocal(dailyStory);
  }, [dailyStory]);

  useEffect(() => {
    const shouldOpenUpgrade = searchParams.get("upgrade") === "1";
    if (!shouldOpenUpgrade) return;
    const featureHint = searchParams.get("feature");
    setUpgradeFeatureHint(featureHint ?? undefined);
    setShowUpgradeModal(true);
    if (pathname !== "/app") return;
    router.replace("/app", { scroll: false });
  }, [searchParams, pathname, router]);

  useEffect(() => {
    const pendingRequestStr = localStorage.getItem(STORAGE_KEY);
    if (pendingRequestStr) {
      router.replace("/app/topic-islands/loading");
      return;
    }
    loadTopicIslands();
    loadFlashcardsSummary();
    loadTodayReviewCount();
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      // Extract first name from user metadata
      const name =
        (user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
        (user.user_metadata?.name as string | undefined)?.split(" ")[0] ||
        user.email?.split("@")[0] ||
        "there";
      setFirstName(name);
      const { count } = await supabase
        .from("island_words")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("learned_at", "is", null);
      setTotalWordsLearned(count ?? 0);
      const jr = await fetch("/api/journey/active", { cache: "no-store" });
      if (jr.ok) {
        const d = await jr.json();
        setActiveJourney(d.journey);
        setActiveJourneyNodes(d.nodes ?? d.islands ?? []);
      }
      await loadHuahuaProgress();
    })();
  }, [router, supabase]);

  useEffect(() => {
    const onRefreshSignals = () => {
      if (document.visibilityState !== "hidden") {
        void loadTodayReviewCount();
        void loadHuahuaProgress();
      }
    };
    const onHuahuaProgressUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ totalReviews?: number; stage?: number }>).detail;
      if (typeof detail?.totalReviews === "number") {
        setHuahuaTotalReviews(detail.totalReviews);
      }
      if (typeof detail?.stage === "number") {
        setHuahuaStage(detail.stage);
      }
      void loadHuahuaProgress();
    };
    document.addEventListener("visibilitychange", onRefreshSignals);
    window.addEventListener("focus", onRefreshSignals);
    window.addEventListener("huahua-progress-updated", onHuahuaProgressUpdated as EventListener);
    return () => {
      document.removeEventListener("visibilitychange", onRefreshSignals);
      window.removeEventListener("focus", onRefreshSignals);
      window.removeEventListener("huahua-progress-updated", onHuahuaProgressUpdated as EventListener);
    };
  }, []);

  useEffect(() => {
    if (dailyHasTriedRef.current || dailyStoryLocal) return;
    dailyHasTriedRef.current = true;
    const run = async () => {
      setDailyLoading(true);
      try {
        const today = getLocalDateKey();
        const response = await fetch(`/api/story/daily?date=${today}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (data.story) {
          setDailyStoryLocal(data.story);
        }
      } catch (error) {
        console.error("Error generating daily story:", error);
      } finally {
        setDailyLoading(false);
      }
    };
    void run();
  }, [dailyStoryLocal]);

  const loadTopicIslands = async () => {
    const { data, error } = await supabase
      .from("topic_islands")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading topic islands:", error);
    } else {
      setTopicIslands(data || []);
    }
    setLoading(false);
  };

  const loadHuahuaProgress = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("huahua_stage, huahua_reviews_today, huahua_last_review_date, huahua_total_reviews")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileError) {
        // huahua_reviews_today column may not exist yet — fall back to total reviews.
        const { data: fb } = await supabase
          .from("user_profiles")
          .select("huahua_stage, huahua_total_reviews")
          .eq("user_id", user.id)
          .maybeSingle();
        if (fb) {
          setHuahuaTotalReviews(fb.huahua_total_reviews ?? 0);
          setHuahuaStage(fb.huahua_stage ?? 1);
        }
        return;
      }
      if (!profile) return;

      const today = new Date().toISOString().split("T")[0];
      if (profile.huahua_reviews_today != null) {
        // Daily-reset columns exist — use them.
        const isToday = profile.huahua_last_review_date === today;
        const reviews = isToday ? (profile.huahua_reviews_today ?? 0) : 0;
        setHuahuaTotalReviews(reviews);
        setHuahuaStage(isToday ? (profile.huahua_stage ?? 1) : 1);
      } else {
        // Columns not yet in schema — use total reviews.
        setHuahuaTotalReviews(profile.huahua_total_reviews ?? 0);
        setHuahuaStage(profile.huahua_stage ?? 1);
      }
    } catch (error) {
      console.error("Error loading huahua progress:", error);
    }
  };

  const loadFlashcardsSummary = async () => {
    try {
      const [decksResponse, quizResponse] = await Promise.all([
        fetch("/api/quiz-islands"),
        fetch("/api/quiz/daily"),
      ]);

      if (decksResponse.ok) {
        const decksData = await decksResponse.json();
        const decks = (decksData.quizIslands || []) as QuizIslandSummary[];
        setFlashcardDecks(decks);
        void loadQuizStats(decks);
      }

      if (quizResponse.ok) {
        const quizData = await quizResponse.json();
        const cards: QuizCardSummary[] = quizData.cards || [];
        const now = Date.now();
        const dueCount = cards.filter((card) => {
          const dueAt = card.reviewState?.dueAt;
          if (!dueAt) return false;
          return new Date(dueAt).getTime() <= now;
        }).length;
        setDueCardCount(dueCount);
      }
    } catch (error) {
      console.error("Error loading flashcards summary:", error);
    } finally {
      setFlashcardsLoading(false);
    }
  };

  const loadQuizStats = async (islands: QuizIslandSummary[]) => {
    if (!islands.length) {
      setQuizStatsByIsland({});
      return;
    }
    try {
      const results = await Promise.all(
        islands.map(async (island) => {
          const first = await supabase.rpc("get_quiz_stats", {
            quiz_island_id: island.id,
          } as never);
          const second =
            first.error &&
            (await supabase.rpc("get_quiz_stats", {
              p_quiz_island_id: island.id,
            } as never));
          const data = (second ? second.data : first.data) as unknown;
          const error = second ? second.error : first.error;
          if (error) {
            return [island.id, null] as const;
          }
          const row = Array.isArray(data) ? data[0] : data;
          return [island.id, (row as QuizStatsRow) || null] as const;
        }),
      );
      const next: Record<string, QuizStatsRow> = {};
      results.forEach(([id, stats]) => {
        if (stats) next[id] = stats;
      });
      setQuizStatsByIsland(next);
    } catch (error) {
      console.error("Error loading quiz stats:", error);
      setQuizStatsByIsland({});
    }
  };

  const loadTodayReviewCount = async () => {
    setIslandLoading(true);
    try {
      const tzOffset = new Date().getTimezoneOffset();
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const response = await fetch(
        `/api/quiz-activity?year=${year}&month=${month}&tzOffset=${tzOffset}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        setTodayReviewCount(0);
        setLast7DaysActivity([]);
        return;
      }
      const data = await response.json();
      const todayKey = getLocalDateKey();
      const todayEntry = (data.activity || []).find(
        (entry: { date: string; count: number }) => entry.date === todayKey,
      );
      setTodayReviewCount(todayEntry?.count ?? 0);

      const activityMap = new Map<string, number>();
      (data.activity || []).forEach(
        (entry: { date: string; count: number }) => {
          activityMap.set(entry.date, entry.count);
        },
      );

      const last7Days: { date: string; count: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split("T")[0];
        last7Days.push({
          date: dateKey,
          count: activityMap.get(dateKey) || 0,
        });
      }
      setLast7DaysActivity(last7Days);
    } catch (error) {
      console.error("Error loading review count:", error);
      setTodayReviewCount(0);
      setLast7DaysActivity([]);
    } finally {
      setIslandLoading(false);
    }
  };

  // Keep existing memos (data still available even if not rendered)
  const deckCards = useMemo<FlashcardDeckCard[]>(() => {
    if (flashcardsLoading) return [];
    const buildCard = (deck: QuizIslandSummary, index: number): FlashcardDeckCard => {
      const stats = quizStatsByIsland[deck.id];
      const dueCount = (stats?.forgot_count ?? 0) + (stats?.hard_count ?? 0);
      const totalCount = stats?.total_count ?? deck.card_count ?? 0;
      const progressPercent = Math.min(
        100,
        totalCount > 0 ? Math.round(((totalCount - dueCount) / totalCount) * 100) : 0,
      );
      const statusLabel =
        dueCount > 8
          ? convertText(t("Review"))
          : dueCount > 4
            ? convertText(t("Practice"))
            : convertText(t("New"));
      return { ...deck, dueCount, totalCount, statusLabel, progressPercent };
    };
    return flashcardDecks.map(buildCard);
  }, [flashcardsLoading, flashcardDecks, quizStatsByIsland, t, convertText]);

  const streakDays = useMemo(() => {
    let s = 0;
    for (let i = last7DaysActivity.length - 1; i >= 0; i--) {
      if (last7DaysActivity[i].count > 0) s += 1;
      else break;
    }
    return s;
  }, [last7DaysActivity]);

  // Capybara progress for greeting
  const safeStage = Math.min(5, Math.max(1, huahuaStage || 1));
  const nextThreshold = safeStage < 5 ? STAGE_THRESHOLDS[safeStage] : null;
  const reviewsUntilNext = nextThreshold
    ? Math.max(0, nextThreshold - huahuaTotalReviews)
    : 0;

  // Time-based greeting
  const timeGreeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-gray-400">
          <svg
            className="h-5 w-5 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-sm">{convertText(t("Loading..."))}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky top bar */}
      <TopBar
        streakDays={streakDays}
        wordsLearned={totalWordsLearned}
        dueCount={dueCardCount}
        stage={huahuaStage}
      />

      {/* Page content */}
      <div className="mx-auto max-w-[1060px] px-9 py-8">

        {/* Greeting */}
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            {timeGreeting}, {firstName} 👋
          </h1>
          {!islandLoading && (
            <p className="mt-1 text-sm font-medium text-slate-400">
              {reviewsUntilNext > 0
                ? `${reviewsUntilNext} more card${reviewsUntilNext !== 1 ? "s" : ""} and 华华 hits Stage ${safeStage + 1}.`
                : "华华's island is thriving! Keep it up."}
            </p>
          )}
        </div>

        {/* Active Journey — full width */}
        <JourneyHero journey={activeJourney} nodes={activeJourneyNodes} />

        {/* 3-col grid */}
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <CapybaraCard stage={huahuaStage} totalReviews={huahuaTotalReviews} />
          <HomeDailyStoryCard story={dailyStoryLocal} loading={dailyLoading} />
          <CreateIslandDashCard />
        </div>

      </div>

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={upgradeFeatureHint}
      />
    </div>
  );
}
