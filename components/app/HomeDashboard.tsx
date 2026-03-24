"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import DailyStoryCard, {
  type DailyStorySummary,
} from "@/components/stories/DailyStoryCard";
import CreateIslandCard from "@/components/app/CreateIslandCard";
import JourneyHero from "@/components/app/JourneyHero";
import CapybaraStrip from "@/components/app/CapybaraStrip";
import { getLocalDateKey } from "@/lib/utils/date";
import { useSidebar } from "@/components/app/AppLayoutClient";
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
  const [capybaraOpen, setCapybaraOpen] = useState(false);
  const { isAnonymous, openSignupModal } = useSidebar();
  const islandsScrollRef = useRef<HTMLDivElement | null>(null);
  const flashcardsScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDailyStoryLocal(dailyStory);
  }, [dailyStory]);

  useEffect(() => {
    // If there's a pending island request, defer to the dedicated loading page
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
      const { count } = await supabase
        .from("island_words")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);
      setTotalWordsLearned(count ?? 0);
      const jr = await fetch("/api/journey/active", { cache: "no-store" });
      if (jr.ok) {
        const d = await jr.json();
        setActiveJourney(d.journey);
        setActiveJourneyNodes(d.nodes ?? d.islands ?? []);
      }
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("huahua_stage, huahua_total_reviews")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile) {
        setHuahuaStage(profile.huahua_stage ?? 1);
        setHuahuaTotalReviews(profile.huahua_total_reviews ?? 0);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch today's review count when tab becomes visible so Progress Island updates after quiz sessions
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadTodayReviewCount();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
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

      // Get last 7 days of activity
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

  const showFlashcardsPanel = !flashcardsLoading;
  const deckCards = useMemo<FlashcardDeckCard[]>(() => {
    if (flashcardsLoading) return [];

    const buildCard = (
      deck: QuizIslandSummary,
      index: number,
    ): FlashcardDeckCard => {
      const stats = quizStatsByIsland[deck.id];
      const dueCount = (stats?.forgot_count ?? 0) + (stats?.hard_count ?? 0);
      const totalCount = stats?.total_count ?? deck.card_count ?? 0;
      const progressPercent = Math.min(
        100,
        totalCount > 0
          ? Math.round(((totalCount - dueCount) / totalCount) * 100)
          : 0,
      );
      const statusLabel =
        dueCount > 8
          ? convertText(t("Review"))
          : dueCount > 4
            ? convertText(t("Practice"))
            : convertText(t("New"));

      return {
        ...deck,
        dueCount,
        totalCount,
        statusLabel,
        progressPercent,
      };
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

  const handleCreateIsland = () => {
    if (isAnonymous) {
      openSignupModal("Topic Islands");
      return;
    }
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <svg
            className="h-5 w-5 animate-spin text-gray-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          <span>{convertText(t("Loading..."))}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white px-4 py-6 md:px-6 md:py-8 lg:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 md:gap-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-900">
              🔥 {streakDays} day streak
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-white px-3 py-1.5 text-sm text-teal-700">
              🧠 {totalWordsLearned} words learned
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700">
              ⏰ {dueCardCount} due for review
            </span>
            {!islandLoading && last7DaysActivity.length > 0 ? (
              <div className="hidden items-center gap-1 sm:flex" title="Last 7 days">
                {last7DaysActivity.map((day) => (
                  <div
                    key={day.date}
                    className={`h-2.5 w-2.5 rounded-full ${
                      day.count > 0 ? "bg-teal-500" : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setCapybaraOpen((o) => !o)}
              className={`ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                capybaraOpen
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-400"
              }`}
            >
              <span>🦫</span>
              <span>华华</span>
              <span className="opacity-40">{capybaraOpen ? "▲" : "▼"}</span>
            </button>
          </div>

          {capybaraOpen ? (
            <CapybaraStrip stage={huahuaStage} totalReviews={huahuaTotalReviews} />
          ) : null}

          <JourneyHero journey={activeJourney} nodes={activeJourneyNodes} />
        </div>

        {/* ROW 2: Create Topic Island + Read Daily Story (2 columns on desktop, stack on mobile) */}
        <div className="grid gap-4 md:gap-6 md:grid-cols-2">
          <CreateIslandCard
            onCreate={handleCreateIsland}
            onBrowse={
              isAnonymous
                ? (e) => {
                    e.preventDefault();
                    openSignupModal("Browse Topics");
                  }
                : undefined
            }
          />
          <DailyStoryCard
            variant="home"
            story={dailyStoryLocal}
            loading={dailyLoading}
            onRead={
              isAnonymous
                ? (e) => {
                    e.preventDefault();
                    openSignupModal("Stories");
                  }
                : undefined
            }
          />
        </div>

        {/* ROW 3: Review Topic Islands + Review Quiz Islands */}
        <div className="grid gap-4 md:gap-6 md:grid-cols-2">
          {/* Review your Topic Islands */}
          <div className={`${cardBaseClass} ${cardHoverClass} p-4 md:p-6`}>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base md:text-lg font-semibold text-gray-900">
                  {convertText(t("Review your Topic Islands"))}
                </h2>
                <p className="mt-1 text-xs md:text-sm text-gray-600">
                  {convertText(t("Quick refreshes."))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleScrollIslands("left")}
                  className={buttonIconClass}
                  aria-label={convertText(t("Scroll islands left"))}
                >
                  ←
                </button>
                <button
                  onClick={() => handleScrollIslands("right")}
                  className={buttonIconClass}
                  aria-label={convertText(t("Scroll islands right"))}
                >
                  →
                </button>
                <Link
                  href="/app/topic-islands"
                  className={buttonSecondaryClass}
                  onClick={
                    isAnonymous
                      ? (e) => {
                          e.preventDefault();
                          openSignupModal("Topic Islands");
                        }
                      : undefined
                  }
                >
                  {convertText(t("View All"))}
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
                        (1000 * 60 * 60 * 24),
                    ),
                  );
                  const dueCount = (daysSince * 3 + index * 2) % 12;
                  const statusLabel =
                    dueCount > 6
                      ? convertText(t("Due soon"))
                      : convertText(t("On track"));
                  const lastReviewed = Math.min(9, daysSince);

                  return (
                    <div
                      key={island.id}
                      className={`${cardBaseClass} ${cardHoverClass} min-h-[180px] min-w-[180px] sm:min-w-[220px] md:min-w-[240px] max-w-[280px] p-4 flex h-full flex-col`}
                    >
                      <h3
                        className="text-base font-semibold text-gray-900 truncate"
                        title={island.topic}
                      >
                        {convertText(
                          island.topic.length > 48
                            ? `${island.topic.slice(0, 45)}...`
                            : island.topic,
                        )}
                      </h3>
                      <p className="mt-1.5 text-sm text-gray-600">
                        {island.word_target} {convertText(t("words"))} /{" "}
                        {island.level}
                      </p>
                      <p className="mt-1.5 text-xs text-gray-500">
                        {statusLabel} · {Math.max(1, dueCount)}{" "}
                        {convertText(t("due"))}
                        {" · "}
                        {convertText(t("Last reviewed"))}: {lastReviewed}
                        {convertText(t("day short"))}
                      </p>
                      <Link
                        href={`/app/topic-islands/${island.id}`}
                        className={`${buttonPrimaryClass} mt-auto`}
                        onClick={
                          isAnonymous
                            ? (e) => {
                                e.preventDefault();
                                openSignupModal("Topic Islands");
                              }
                            : undefined
                        }
                      >
                        {convertText(t("Review"))}
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                <p className="mb-4 text-sm text-gray-600">
                  {convertText(
                    t("Create your first island to start reviewing words."),
                  )}
                </p>
                <button
                  onClick={handleCreateIsland}
                  className="rounded-lg border border-gray-900 bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                >
                  {convertText(
                    t(
                      isAnonymous
                        ? "Create Account to Start"
                        : "Create your first island",
                    ),
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Review your Quiz Islands */}
          <div className={`${cardBaseClass} ${cardHoverClass} p-4 md:p-5`}>
            <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base md:text-lg font-semibold text-gray-900">
                  {convertText(t("Review your Quiz Islands"))}
                </h2>
                <p className="mt-1 text-xs md:text-sm text-gray-600">
                  {convertText(t("Decks ready."))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleScrollDecks("left")}
                  className={buttonIconClass}
                  aria-label={convertText(t("Scroll decks left"))}
                >
                  ←
                </button>
                <button
                  onClick={() => handleScrollDecks("right")}
                  className={buttonIconClass}
                  aria-label={convertText(t("Scroll decks right"))}
                >
                  →
                </button>
                <Link
                  href="/app/quiz"
                  className={buttonSecondaryClass}
                  onClick={
                    isAnonymous
                      ? (e) => {
                          e.preventDefault();
                          openSignupModal("Quizzes");
                        }
                      : undefined
                  }
                >
                  {convertText(t("View Decks"))}
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
                        className={`${cardBaseClass} ${cardHoverClass} min-h-[180px] min-w-[180px] sm:min-w-[220px] md:min-w-[240px] max-w-[280px] p-4 flex h-full flex-col snap-start`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className="min-w-0 flex-1 text-sm font-semibold text-gray-900 truncate"
                            title={deck.name}
                          >
                            {convertText(deck.name)}
                          </div>
                          <span className="shrink-0 whitespace-nowrap rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                            {deck.dueCount} {convertText(t("due"))}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-gray-600">
                          {deck.statusLabel} · {deck.totalCount}{" "}
                          {convertText(t("cards"))}
                        </p>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-[11px] text-gray-500">
                            <span>
                              {deck.totalCount} {convertText(t("cards"))}
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
                          className={`${buttonPrimaryClass} mt-auto`}
                          onClick={
                            isAnonymous
                              ? (e) => {
                                  e.preventDefault();
                                  openSignupModal("Quizzes");
                                }
                              : undefined
                          }
                        >
                          {convertText(t("Review"))}
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                    <p className="mb-4 text-sm text-gray-600">
                      {convertText(
                        t(
                          "No flashcard decks yet. Create your first one to start practicing.",
                        ),
                      )}
                    </p>
                    <Link
                      href="/app/quiz"
                      className="rounded-lg border border-gray-900 bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                      onClick={
                        isAnonymous
                          ? (e) => {
                              e.preventDefault();
                              openSignupModal("Quizzes");
                            }
                          : undefined
                      }
                    >
                      {convertText(
                        t(
                          isAnonymous
                            ? "Create Account to Start"
                            : "Create your first deck",
                        ),
                      )}
                    </Link>
                  </div>
                )
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-sm text-gray-600">
                  {convertText(t("Add a deck to start reviewing flashcards."))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
