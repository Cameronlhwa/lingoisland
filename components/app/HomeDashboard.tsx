"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import DailyStoryCard, {
  type DailyStorySummary,
} from "@/components/stories/DailyStoryCard";
import CreateIslandCard from "@/components/app/CreateIslandCard";
import { getLocalDateKey } from "@/lib/utils/date";
import { OceanBackground } from "@/components/OceanBackground";
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
      // Image generation disabled - using pre-generated library images for cost savings

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
        dueCount > 8 ? convertText(t("Review")) : dueCount > 4 ? convertText(t("Practice")) : convertText(t("New"));

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
  
  // Progress island calculation - every 10 reviews = next stage (0-5 index for stages 1-6)
  const progressStage = Math.min(5, Math.floor(todayReviewCount / 10));
  const progressImageSrc = `/progress-islands/stage-${progressStage + 1}.png`;
  const stageProgress = todayReviewCount % 10; // 0-9 within current stage
  const nextMilestone = (progressStage + 1) * 10;
  
  // Status messages based on stage
  const islandStatus =
    progressStage >= 5
      ? convertText(t("The ultimate magnificent island paradise!"))
      : progressStage === 4
      ? convertText(t("The island is prosperous and flourishing!"))
      : progressStage === 3
      ? convertText(t("The island is thriving!"))
      : progressStage === 2
      ? convertText(t("The island is growing well..."))
      : progressStage === 1
      ? convertText(t("The island is developing..."))
      : convertText(t("The island is dry with no resources"));

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
          <span>
            {processingPendingRequest
              ? convertText(t("Creating your topic island..."))
              : convertText(t("Loading..."))}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen px-4 py-6 md:px-6 md:py-8 lg:px-10">
      <OceanBackground />
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-4 md:gap-6">
        {/* ROW 1: Your Progress Island (full width) */}
        <div className={`${cardBaseClass} ${cardHoverClass} p-3 md:p-4`}>
          <div className="mb-2">
            <h2 className="text-xl md:text-2xl font-semibold text-slate-900">
              {convertText(t("Your Progress Island"))}
            </h2>
            <p className="mt-1.5 text-base md:text-lg text-slate-600">
              {islandLoading
                ? convertText(t("Counting today's reviews..."))
                : progressStage >= 5
                ? convertText(`${t("Reviewed")} ${todayReviewCount} ${t("cards")} ${t("today")} · Stage 6 (max level!)`)
                : convertText(`${t("Reviewed")} ${todayReviewCount} ${t("cards")} ${t("today")} · ${stageProgress}/10 to next stage`)}
            </p>
            {!islandLoading ? (
              <p className="mt-1 text-sm text-slate-500">
                {islandStatus}
              </p>
            ) : null}
          </div>
          <div 
            className="relative flex items-center justify-center rounded-xl border-2 border-slate-200 p-2 md:p-3 overflow-visible max-h-40 md:max-h-48 lg:max-h-56"
            style={{
              background: 'linear-gradient(to bottom, #EAF6FF 0%, #CFEFFF 50%, #B7E5FF 100%)'
            }}
          >
            {/* Animated wave particles - always visible */}
            <div className="absolute inset-0 pointer-events-none">
              <motion.div 
                className="absolute" 
                style={{ left: '10%', top: '20%', opacity: 0.15 }}
                animate={{ x: [0, 50, 0] }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              >
                <svg width="50" height="20" viewBox="0 0 50 20" fill="none">
                  <path d="M 2 16 Q 10 14, 18 8 Q 24 4, 32 8 Q 40 12, 48 14" stroke="#0B1B3A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                </svg>
              </motion.div>
              <motion.div 
                className="absolute" 
                style={{ left: '65%', top: '15%', opacity: 0.12 }}
                animate={{ x: [0, -40, 0] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear", delay: 1 }}
              >
                <svg width="70" height="26" viewBox="0 0 70 26" fill="none">
                  <path d="M 2 22 Q 14 18, 26 10 Q 34 4, 44 10 Q 54 16, 68 20" stroke="#0B1B3A" strokeWidth="3" strokeLinecap="round" fill="none" />
                </svg>
              </motion.div>
              <motion.div 
                className="absolute" 
                style={{ left: '30%', top: '60%', opacity: 0.18 }}
                animate={{ x: [0, 35, 0] }}
                transition={{ duration: 18, repeat: Infinity, ease: "linear", delay: 2 }}
              >
                <svg width="70" height="26" viewBox="0 0 70 26" fill="none">
                  <path d="M 2 22 Q 14 18, 26 10 Q 34 4, 44 10 Q 54 16, 68 20" stroke="#0B1B3A" strokeWidth="3" strokeLinecap="round" fill="none" />
                </svg>
              </motion.div>
              <motion.div 
                className="absolute" 
                style={{ left: '75%', top: '65%', opacity: 0.15 }}
                animate={{ x: [0, -45, 0] }}
                transition={{ duration: 22, repeat: Infinity, ease: "linear", delay: 0.5 }}
              >
                <svg width="50" height="20" viewBox="0 0 50 20" fill="none">
                  <path d="M 2 16 Q 10 14, 18 8 Q 24 4, 32 8 Q 40 12, 48 14" stroke="#0B1B3A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                </svg>
              </motion.div>
              <motion.div 
                className="absolute" 
                style={{ left: '15%', top: '75%', opacity: 0.12 }}
                animate={{ x: [0, 50, 0] }}
                transition={{ duration: 28, repeat: Infinity, ease: "linear", delay: 1.5 }}
              >
                <svg width="90" height="30" viewBox="0 0 90 30" fill="none">
                  <path d="M 2 26 Q 18 22, 34 12 Q 46 4, 58 12 Q 72 20, 88 24" stroke="#0B1B3A" strokeWidth="3.5" strokeLinecap="round" fill="none" />
                </svg>
              </motion.div>
            </div>
            {!islandLoading && (
              <Image
                src={progressImageSrc}
                alt="Your Progress Island"
                width={640}
                height={320}
                className="relative z-10 h-48 md:h-60 lg:h-72 w-full max-w-3xl object-contain"
                priority
              />
            )}
            {islandLoading && (
              <div className="relative z-10 flex items-center justify-center h-48 md:h-60 lg:h-72">
                <div className="text-gray-600 text-sm">{convertText(t("Loading..."))}</div>
              </div>
            )}
          </div>
        </div>

        {/* ROW 2: Create Topic Island + Read Daily Story (2 columns on desktop, stack on mobile) */}
        <div className="grid gap-4 md:gap-6 md:grid-cols-2">
          <CreateIslandCard onCreate={handleCreateIsland} />
          <DailyStoryCard
            variant="home"
            story={dailyStoryLocal}
            loading={dailyLoading}
          />
        </div>

        {/* ROW 3: Review Topic Islands + Review Quiz Islands (desktop only) */}
        <div className="hidden md:grid gap-4 md:gap-6 md:grid-cols-2">
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
                        (1000 * 60 * 60 * 24)
                    )
                  );
                  const dueCount = (daysSince * 3 + index * 2) % 12;
                  const statusLabel =
                    dueCount > 6 ? convertText(t("Due soon")) : convertText(t("On track"));
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
                        {convertText(island.topic.length > 48
                          ? `${island.topic.slice(0, 45)}...`
                          : island.topic)}
                      </h3>
                      <p className="mt-1.5 text-sm text-gray-600">
                        {island.word_target} {convertText(t("words"))} / {island.level}
                      </p>
                      <p className="mt-1.5 text-xs text-gray-500">
                        {statusLabel} · {Math.max(1, dueCount)} {convertText(t("due"))}
                        {" · "}
                        {convertText(t("Last reviewed"))}: {lastReviewed}
                        {convertText(t("day short"))}
                      </p>
                      <Link
                        href={`/app/topic-islands/${island.id}`}
                        className={`${buttonPrimaryClass} mt-auto`}
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
                  {convertText(t("Create your first island to start reviewing words."))}
                </p>
                <button
                  onClick={handleCreateIsland}
                  className="rounded-lg border border-gray-900 bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                >
                  {convertText(t("Create your first island"))}
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
                <Link href="/app/quiz" className={buttonSecondaryClass}>
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
                          {deck.statusLabel} · {deck.totalCount} {convertText(t("cards"))}
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
                        >
                          {convertText(t("Review"))}
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                    <p className="mb-4 text-sm text-gray-600">
                      {convertText(t(
                        "No flashcard decks yet. Create your first one to start practicing."
                      ))}
                    </p>
                    <Link
                      href="/app/quiz"
                      className="rounded-lg border border-gray-900 bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-gray-800"
                    >
                      {convertText(t("Create your first deck"))}
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
