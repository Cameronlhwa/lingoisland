"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import OnboardingNudgeBanner from "@/components/Onboarding/OnboardingNudgeBanner";
import { useSubscription } from "@/hooks/useSubscription";
import { STAGE_THRESHOLDS, STAGE_NAMES, STAGE_EMOJIS } from "@/lib/huahua";
import { hskLabelForCefr } from "@/lib/levelBands";
import {
  HSK_CARD_BORDER,
  HSK_CARD_SHADOW,
  HSK_CARD_SHADOW_HOVER,
} from "@/lib/glossy-theme";
import { ArrowRight, Flame, Layers, Plus } from "lucide-react";

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


// ─── Sub-components ───────────────────────────────────────────────────────────

function Chip({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "solid";
}) {
  const className =
    tone === "solid"
      ? "bg-[var(--lingo-navy)] text-white border-transparent"
      : tone === "accent"
        ? "bg-[var(--lingo-sky-pale)] text-[var(--lingo-navy)] border-[var(--lingo-accent-border)]"
        : "bg-white text-[var(--lingo-navy)] border-[var(--lingo-accent-border)]";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${className}`}
    >
      {children}
    </span>
  );
}

function DashCardShell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`group flex min-h-[320px] flex-col overflow-hidden rounded-2xl bg-white transition-all hover:-translate-y-0.5 ${className}`}
      style={{ border: HSK_CARD_BORDER, boxShadow: HSK_CARD_SHADOW }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = HSK_CARD_SHADOW_HOVER;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = HSK_CARD_SHADOW;
      }}
    >
      {children}
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
    <DashCardShell>
      <div className="flex h-[200px] items-center justify-center bg-[var(--lingo-sky-pale)] px-2 sm:h-[220px]">
        <div className="relative h-full w-full">
          <Image
            src={`/progress-islands/stage-${safeStage}.png`}
            alt={`华华's island — Stage ${safeStage}`}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 320px"
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--lingo-sky-pale)] text-[var(--lingo-blue)]">
          <Layers className="h-5 w-5" aria-hidden />
        </span>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-teal)]">
          华华&apos;s Island
        </p>
        <h3 className="lingo-display mt-1.5 text-lg text-[var(--lingo-navy)]">
          Stage {safeStage} · {stageName}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--lingo-text-muted)]">
          {isComplete
            ? "Island complete — keep reviewing to stay sharp."
            : `Currently: ${stageEmoji} ${stageName}`}
        </p>
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--lingo-sky-pale)]">
            <div
              className="h-full rounded-full bg-[var(--lingo-navy)] transition-all duration-500"
              style={{ width: `${stageProgress}%` }}
            />
          </div>
          {!isComplete && (
            <p className="mt-2 text-xs text-[var(--lingo-text-muted)]">
              {reviewsUntilNext} more card{reviewsUntilNext !== 1 ? "s" : ""} to
              Stage {safeStage + 1}
            </p>
          )}
        </div>
        <Link
          href="/app/quiz"
          className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-bold text-[var(--lingo-blue)] transition-colors group-hover:text-[var(--lingo-navy)]"
        >
          Review cards <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </DashCardShell>
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
      <DashCardShell>
        <div className="flex h-[200px] items-center justify-center bg-[var(--lingo-sky-pale)] sm:h-[220px]">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--lingo-accent-border)] border-t-[var(--lingo-blue)]" />
        </div>
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-teal)]">
            Daily Story
          </p>
          <p className="mt-2 text-sm text-[var(--lingo-text-muted)]">
            Generating today&apos;s story…
          </p>
        </div>
      </DashCardShell>
    );
  }

  if (!story) {
    return (
      <DashCardShell>
        <div className="flex h-[200px] flex-col items-center justify-center bg-[var(--lingo-sky-pale)] sm:h-[220px]">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
            📖
          </span>
        </div>
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-teal)]">
            Daily Story
          </p>
          <h3 className="lingo-display mt-1.5 text-lg text-[var(--lingo-navy)]">
            No story yet today
          </h3>
          <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[var(--lingo-text-muted)]">
            Generate a short reading for today&apos;s practice.
          </p>
          <Link
            href="/app/story/daily"
            className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[var(--lingo-blue)] transition-colors group-hover:text-[var(--lingo-navy)]"
          >
            Generate story <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </DashCardShell>
    );
  }

  const level = (story as any).level as string | undefined;
  const lengthChars = (story as any).length_chars as number | undefined;
  const storyZh = (story as any).story_zh as string | undefined;
  const storyId = (story as any).id as string | undefined;
  const title = (story as any).title as string | undefined;
  const titleEn = (story as any).title_en as string | null | undefined;

  const readMins = lengthChars ? Math.max(1, Math.ceil(lengthChars / 200)) : 2;
  const excerpt = storyZh
    ? storyZh.slice(0, 80) + (storyZh.length > 80 ? "…" : "")
    : "";

  return (
    <DashCardShell>
      <div className="flex h-[200px] flex-col justify-end bg-[var(--lingo-sky-pale)] p-5 sm:h-[220px] sm:p-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {level && (
            <span className="rounded-full border border-[var(--lingo-accent-border)] bg-white/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--lingo-navy)]">
              {hskLabelForCefr(level)}
            </span>
          )}
          <span className="rounded-full border border-[var(--lingo-accent-border)] bg-white/80 px-2.5 py-0.5 text-[10px] font-semibold text-[var(--lingo-text-muted)]">
            ~{readMins} min
          </span>
        </div>
        <p className="lingo-display line-clamp-2 text-xl leading-tight text-[var(--lingo-navy)]">
          {title ?? "今日故事"}
        </p>
        {titleEn && (
          <p className="mt-1 line-clamp-1 text-sm text-[var(--lingo-text-muted)]">
            {titleEn}
          </p>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-teal)]">
          Daily Story · Today
        </p>
        {excerpt && (
          <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-[var(--lingo-text-muted)]">
            {excerpt}
          </p>
        )}
        <Link
          href={storyId ? `/app/story/${storyId}` : "/app/story/daily"}
          className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[var(--lingo-blue)] transition-colors group-hover:text-[var(--lingo-navy)]"
        >
          Read story <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </DashCardShell>
  );
}

function CreateIslandDashCard() {
  return (
    <DashCardShell>
      <div className="flex h-[200px] flex-col items-center justify-center bg-[var(--lingo-sky-pale)] sm:h-[220px]">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[var(--lingo-blue)] shadow-sm">
          <Plus className="h-7 w-7" strokeWidth={2.2} aria-hidden />
        </span>
        <p className="mt-3 text-sm font-semibold text-[var(--lingo-text-muted)]">
          New island
        </p>
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-teal)]">
          Topic Islands
        </p>
        <h3 className="lingo-display mt-1.5 text-lg text-[var(--lingo-navy)]">
          Create a specialized island
        </h3>
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[var(--lingo-text-muted)]">
          Pick any topic and get vocab + examples tailored to your level.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Link
            href="/app/topic-islands?create=1"
            className="inline-flex items-center gap-1 text-sm font-bold text-[var(--lingo-blue)] transition-colors group-hover:text-[var(--lingo-navy)]"
          >
            Create island <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <Link
            href="/app/browse-topics"
            className="text-sm font-semibold text-[var(--lingo-text-muted)] transition-colors hover:text-[var(--lingo-navy)]"
          >
            Browse topics →
          </Link>
        </div>
      </div>
    </DashCardShell>
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
      try {
        const jr = await fetch("/api/journey/active", { cache: "no-store" });
        if (jr.ok) {
          const d = await jr.json();
          setActiveJourney(d.journey);
          setActiveJourneyNodes(d.nodes ?? d.islands ?? []);
        }
      } catch {
        // Ignore transient network/Fast Refresh failures
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
      <div className="flex min-h-full items-center justify-center bg-white">
        <span className="text-sm text-[var(--lingo-text-muted)]">
          {convertText(t("Loading..."))}
        </span>
      </div>
    );
  }

  const safeStageName = STAGE_NAMES[safeStage - 1];

  return (
    <div className="min-h-full bg-white px-4 py-6 sm:px-6 md:px-8 md:py-7">
      <OnboardingNudgeBanner variant="home" />

      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="lingo-display text-[30px] leading-tight text-[var(--lingo-navy)] sm:text-[34px]">
              {timeGreeting}, {firstName}
            </h1>
            {!islandLoading && (
              <p className="mt-1.5 text-[15px] text-[var(--lingo-text-muted)]">
                {reviewsUntilNext > 0
                  ? `${reviewsUntilNext} more card${reviewsUntilNext !== 1 ? "s" : ""} and 华华 hits Stage ${safeStage + 1}.`
                  : "华华's island is thriving — keep it up."}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <Chip tone="accent">
              <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden />
              {streakDays} day streak
            </Chip>
            <Chip>{totalWordsLearned} words learned</Chip>
            {dueCardCount > 0 && <Chip>{dueCardCount} due</Chip>}
            <Chip tone="solid">
              华华 · Stage {safeStage} · {safeStageName}
            </Chip>
          </div>
        </header>

        <JourneyHero journey={activeJourney} nodes={activeJourneyNodes} />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
