"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import DailyStoryCard, {
  type DailyStorySummary,
} from "@/components/stories/DailyStoryCard";
import HeroContinueCard from "@/components/app/HeroContinueCard";
import CreateIslandCard from "@/components/app/CreateIslandCard";
import StreakCard from "@/components/app/StreakCard";
import { getLocalDateKey } from "@/lib/utils/date";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  buttonIconClass,
  cardBaseClass,
  cardHoverClass,
} from "@/components/app/ui/styles";

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

export default function HomeDashboard({
  dailyStory,
}: {
  dailyStory: DailyStorySummary | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();
  const [topicIslands, setTopicIslands] = useState<TopicIsland[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingPendingRequest, setProcessingPendingRequest] =
    useState(false);
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
  const islandsScrollRef = useRef<HTMLDivElement | null>(null);
  const flashcardsScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDailyStoryLocal(dailyStory);
  }, [dailyStory]);

  useEffect(() => {
    // Check for pending request first, before loading islands
    const pendingRequestStr = localStorage.getItem(STORAGE_KEY);
    const params = new URLSearchParams(window.location.search);
    const islandParam = params.get("island");
    if (islandParam) {
      // Keep for compatibility with existing links, even if not used directly.
      params.delete("island");
    }
    if (pendingRequestStr) {
      setProcessingPendingRequest(true);
      handlePendingRequest();
    } else {
      loadTopicIslands();
    }
    loadFlashcardsSummary();
    loadTodayReviewCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        })
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
        { cache: "no-store" }
      );
      if (!response.ok) {
        setTodayReviewCount(0);
        return;
      }
      const data = await response.json();
      const todayKey = getLocalDateKey();
      const todayEntry = (data.activity || []).find(
        (entry: { date: string; count: number }) => entry.date === todayKey
      );
      setTodayReviewCount(todayEntry?.count ?? 0);
    } catch (error) {
      console.error("Error loading review count:", error);
      setTodayReviewCount(0);
    } finally {
      setIslandLoading(false);
    }
  };

  const handlePendingRequest = async () => {
    // Check for pending topic island request from onboarding
    const pendingRequestStr = localStorage.getItem(STORAGE_KEY);
    if (!pendingRequestStr) {
      setProcessingPendingRequest(false);
      loadTopicIslands();
      return;
    }

    try {
      const pendingRequest = JSON.parse(pendingRequestStr);

      // Skip if already processing
      if (pendingRequest.processing) {
        setProcessingPendingRequest(false);
        loadTopicIslands();
        return;
      }

      // Mark as processing immediately to avoid duplicate handling in rare re-mount cases
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...pendingRequest, processing: true })
      );

      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error("[APP PAGE] Error getting user:", userError);
        setProcessingPendingRequest(false);
        loadTopicIslands();
        return;
      }

      // Update user profile with CEFR level if provided
      if (pendingRequest.cefrLevel) {
        await supabase
          .from("user_profiles")
          .update({ cefr_level: pendingRequest.cefrLevel })
          .eq("user_id", user.id);
      }

      // Create topic island via API
      const grammarTarget =
        pendingRequest.wantsGrammar && pendingRequest.grammarCount
          ? pendingRequest.grammarCount
          : 0;

      const createResponse = await fetch("/api/topic-islands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: pendingRequest.topic,
          level: pendingRequest.cefrLevel || "B1",
          wordTarget: pendingRequest.wordCount,
          grammarTarget,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            errorData.details ||
            "Failed to create topic island"
        );
      }

      const { islandId } = await createResponse.json();

      if (!islandId) {
        throw new Error("No island ID returned from API");
      }

      // Clear pending request before redirecting
      localStorage.removeItem(STORAGE_KEY);

      // Start generation in the background (fire-and-forget).
      // The island detail page will show a loading state while content is generated.
      fetch(`/api/topic-islands/${islandId}/generate-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: 5 }),
      }).catch((err) =>
        console.error("Error starting topic island generation:", err)
      );

      // Redirect to island detail page using replace to avoid adding to history
      router.replace(`/app/topic-islands/${islandId}`);
    } catch (error) {
      console.error("Error handling pending request:", error);
      // Clear the pending request on error to avoid infinite loops
      localStorage.removeItem(STORAGE_KEY);
      setProcessingPendingRequest(false);
      loadTopicIslands();
    }
  };

  const hasFlashcardsDue = dueCardCount > 0;
  const hasDailyStory = Boolean(dailyStoryLocal);
  const showFlashcardsPanel = !flashcardsLoading;
  const deckCards = useMemo<FlashcardDeckCard[]>(() => {
    if (flashcardsLoading) return [];

    const buildCard = (
      deck: QuizIslandSummary,
      index: number
    ): FlashcardDeckCard => {
      const stats = quizStatsByIsland[deck.id];
      const dueCount = (stats?.forgot_count ?? 0) + (stats?.hard_count ?? 0);
      const totalCount = stats?.total_count ?? deck.card_count ?? 0;
      const progressPercent = Math.min(
        100,
        totalCount > 0
          ? Math.round(((totalCount - dueCount) / totalCount) * 100)
          : 0
      );
      const statusLabel =
        dueCount > 8 ? t("Review") : dueCount > 4 ? t("Practice") : t("New");

      return {
        ...deck,
        dueCount,
        totalCount,
        statusLabel,
        progressPercent,
      };
    };

    return flashcardDecks.map(buildCard);
  }, [flashcardsLoading, flashcardDecks, quizStatsByIsland, t]);
  const treeCount = Math.min(5, Math.floor(todayReviewCount / 20));
  const treePositions = [
    { x: 70, y: 96, scale: 1 },
    { x: 118, y: 104, scale: 0.9 },
    { x: 164, y: 92, scale: 1.05 },
    { x: 212, y: 104, scale: 0.9 },
    { x: 256, y: 96, scale: 1 },
  ].slice(0, treeCount);
  const islandStatus =
    treeCount >= 5
      ? t("The island is thriving!")
      : treeCount > 0
      ? t("The island is growing, but still needs help...")
      : t("The island is dry with no resources");
  const cappedReviews = Math.min(100, todayReviewCount);
  const chips = useMemo(() => {
    const values: string[] = [];
    if (hasDailyStory) values.push(t("Story"));
    if (hasFlashcardsDue) values.push(t("Flashcards"));
    if (topicIslands.length > 0) values.push(t("Island"));
    return values.slice(0, 3);
  }, [hasDailyStory, hasFlashcardsDue, topicIslands.length, t]);

  const handleContinueStart = () => {
    if (hasFlashcardsDue) {
      router.push("/app/quiz");
      return;
    }
    if (dailyStoryLocal?.id) {
      router.push(`/app/story/${dailyStoryLocal.id}`);
      return;
    }
    router.push("/app/topic-islands");
  };

  const handleCreateIsland = () => {
    router.push("/app/topic-islands");
  };

  const handleScrollIslands = (direction: "left" | "right") => {
    const container = islandsScrollRef.current;
    if (!container) return;
    const scrollAmount = Math.max(container.clientWidth * 0.75, 240);
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  const handleScrollDecks = (direction: "left" | "right") => {
    const container = flashcardsScrollRef.current;
    if (!container) return;
    const scrollAmount = Math.max(container.clientWidth * 0.75, 240);
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  };

  if (loading || processingPendingRequest) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">
          {processingPendingRequest
            ? t("Creating your topic island...")
            : t("Loading...")}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 px-6 py-8 lg:px-10">
      <div className="flex w-full flex-col gap-6">
        <div className="grid gap-6 xl:grid-cols-3">
          <HeroContinueCard
            chips={chips}
            onStart={handleContinueStart}
            nextUpText={
              hasFlashcardsDue
                ? `${t("Next")}: ${t("Flashcards")} · 2 ${t(
                    "min"
                  )} · ${dueCardCount} ${t("due")}`
                : `${t("Next")}: ${t("Daily story")} · 2-3 ${t("min")}`
            }
          />
          <DailyStoryCard
            variant="home"
            story={dailyStoryLocal}
            loading={dailyLoading}
          />
          <CreateIslandCard onCreate={handleCreateIsland} />
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="flex flex-col gap-6 xl:col-span-2">
            <div className={`${cardBaseClass} ${cardHoverClass} p-6`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t("Review your islands")}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {t("Quick refreshes.")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleScrollIslands("left")}
                    className={buttonIconClass}
                    aria-label={t("Scroll islands left")}
                  >
                    ←
                  </button>
                  <button
                    onClick={() => handleScrollIslands("right")}
                    className={buttonIconClass}
                    aria-label={t("Scroll islands right")}
                  >
                    →
                  </button>
                  <Link
                    href="/app/topic-islands"
                    className={buttonSecondaryClass}
                  >
                    {t("View All")}
                  </Link>
                </div>
              </div>

              {topicIslands.length > 0 ? (
                <div
                  ref={islandsScrollRef}
                  className="-mx-2 flex gap-4 overflow-x-auto px-2 pb-2"
                >
                  {topicIslands.map((island, index) => {
                    const daysSince = Math.max(
                      1,
                      Math.round(
                        (Date.now() - new Date(island.created_at).getTime()) /
                          (1000 * 60 * 60 * 24)
                      )
                    );
                    const dueCount = (daysSince * 3 + index * 2) % 12;
                    const statusLabel =
                      dueCount > 6 ? t("Due soon") : t("On track");
                    const lastReviewed = Math.min(9, daysSince);

                    return (
                      <div
                        key={island.id}
                        className={`${cardBaseClass} ${cardHoverClass} min-h-[180px] min-w-[240px] max-w-[280px] p-4 flex h-full flex-col`}
                      >
                        <h3
                          className="text-base font-semibold text-gray-900 truncate"
                          title={island.topic}
                        >
                          {island.topic.length > 48
                            ? `${island.topic.slice(0, 45)}...`
                            : island.topic}
                        </h3>
                        <p className="mt-1.5 text-sm text-gray-600">
                          {island.word_target} {t("words")} / {island.level}
                        </p>
                        <p className="mt-1.5 text-xs text-gray-500">
                          {statusLabel} · {Math.max(1, dueCount)} {t("due")}
                          {" · "}
                          {t("Last reviewed")}: {lastReviewed}
                          {t("day short")}
                        </p>
                        <Link
                          href={`/app/topic-islands/${island.id}`}
                          className={`${buttonPrimaryClass} mt-auto`}
                        >
                          {t("Review")}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                  <p className="mb-4 text-sm text-gray-600">
                    {t("Create your first island to start reviewing words.")}
                  </p>
                  <button
                    onClick={handleCreateIsland}
                    className="rounded-lg border border-gray-900 bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                  >
                    {t("Create your first island")}
                  </button>
                </div>
              )}
            </div>

            <div className={`${cardBaseClass} ${cardHoverClass} p-5`}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t("Flashcards")}
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {t("Decks ready.")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleScrollDecks("left")}
                    className={buttonIconClass}
                    aria-label={t("Scroll decks left")}
                  >
                    ←
                  </button>
                  <button
                    onClick={() => handleScrollDecks("right")}
                    className={buttonIconClass}
                    aria-label={t("Scroll decks right")}
                  >
                    →
                  </button>
                  <Link href="/app/quiz" className={buttonSecondaryClass}>
                    {t("View Decks")}
                  </Link>
                </div>
              </div>

              <div className="relative">
                {showFlashcardsPanel ? (
                  deckCards.length > 0 ? (
                    <div
                      ref={flashcardsScrollRef}
                      className="-mx-2 flex snap-x snap-mandatory gap-4 overflow-x-auto px-2 pb-1"
                    >
                      {deckCards.map((deck) => (
                        <div
                          key={deck.id}
                          className={`${cardBaseClass} ${cardHoverClass} flex min-w-[220px] max-w-[240px] snap-start flex-col p-4`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div
                              className="min-w-0 flex-1 text-sm font-semibold text-gray-900 truncate"
                              title={deck.name}
                            >
                              {deck.name}
                            </div>
                            <span className="shrink-0 whitespace-nowrap rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                              {deck.dueCount} {t("due")}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-gray-600">
                            {deck.statusLabel} · {deck.totalCount} {t("cards")}
                          </p>
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-[11px] text-gray-500">
                              <span>
                                {deck.totalCount} {t("cards")}
                              </span>
                              <span>{deck.progressPercent}%</span>
                            </div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-gray-900"
                                style={{ width: `${deck.progressPercent}%` }}
                              />
                            </div>
                          </div>
                          <Link
                            href={`/app/quiz/${deck.id}`}
                            className={`${buttonPrimaryClass} mt-3`}
                          >
                            {t("Review Deck")}
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                      <p className="mb-4 text-sm text-gray-600">
                        {t(
                          "No flashcard decks yet. Create your first one to start practicing."
                        )}
                      </p>
                      <Link
                        href="/app/quiz"
                        className="rounded-lg border border-gray-900 bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                      >
                        {t("Create your first deck")}
                      </Link>
                    </div>
                  )
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
                    {t("Add a deck to start reviewing flashcards.")}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <StreakCard />
            <div className={`${cardBaseClass} ${cardHoverClass} p-4`}>
              <div className="mb-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  {t("Your island")}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {islandLoading
                    ? t("Counting today's reviews...")
                    : `${t("Reviewed")} ${todayReviewCount} ${t("cards")} ${t(
                        "today"
                      )} · ${treeCount}/5 ${t("trees")}`}
                </p>
                {!islandLoading ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {islandStatus} · {cappedReviews}/100 {t("reviews")}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                <svg
                  viewBox="0 0 320 160"
                  className="h-28 w-full"
                  aria-hidden="true"
                >
                  <path
                    d="M24 122 C70 96, 122 94, 170 112 C214 128, 258 130, 296 118 L296 150 L24 150 Z"
                    fill="#0f172a"
                  />
                  {treePositions.map((tree, index) => (
                    <g
                      key={`${tree.x}-${index}`}
                      transform={`translate(${tree.x} ${tree.y}) scale(${tree.scale})`}
                    >
                      <rect
                        x="-2"
                        y="-24"
                        width="6"
                        height="26"
                        fill="#0f172a"
                      />
                      <circle cx="-10" cy="-28" r="12" fill="#0f172a" />
                      <circle cx="8" cy="-32" r="10" fill="#0f172a" />
                      <circle cx="22" cy="-26" r="9" fill="#0f172a" />
                    </g>
                  ))}
                  <g stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round">
                    <line x1="250" y1="36" x2="250" y2="28" />
                    <line x1="250" y1="80" x2="250" y2="88" />
                    <line x1="228" y1="58" x2="220" y2="58" />
                    <line x1="272" y1="58" x2="280" y2="58" />
                    <line x1="235" y1="43" x2="229" y2="37" />
                    <line x1="265" y1="43" x2="271" y2="37" />
                    <line x1="235" y1="73" x2="229" y2="79" />
                    <line x1="265" y1="73" x2="271" y2="79" />
                    <circle cx="250" cy="58" r="14" fill="#f8fafc" />
                  </g>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
