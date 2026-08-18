"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { useLanguage } from "@/contexts/LanguageContext";
import { OceanBackground } from "@/components/OceanBackground";
import { ChevronLeft, ChevronRight, Layers, Map } from "lucide-react";

interface TrendingTopic {
  id: string;
  slug: string;
  title_en: string;
  title_zh?: string;
  category: string;
  tags: string[];
  level: "A2" | "B1" | "B2" | "C1";
  starter_prompts: string[];
  is_featured: boolean;
  rank: number;
}

const CATEGORIES = [
  "All",
  "Everyday errands",
  "Travel",
  "Health",
  "Food & going out",
  "Social life",
  "Work/School",
  "Money & adulting",
  "Entertainment & hobbies",
  "Opinions & hot takes",
  "Unexpected problems",
];

export default function BrowseTopicsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { isChineseMode, t } = useLanguage();

  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [visibleCount, setVisibleCount] = useState(40);
  const [previewTopic, setPreviewTopic] = useState<TrendingTopic | null>(null);
  const [choiceTopic, setChoiceTopic] = useState<TrendingTopic | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTopics();
  }, []);

  useEffect(() => {
    // Check scroll buttons after content is rendered
    const timer = setTimeout(() => {
      checkScrollButtons();
    }, 100);
    return () => clearTimeout(timer);
  }, [topics, selectedCategory]);

  const checkScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 1
    );
  };

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 200;
    const newScrollLeft =
      direction === "left"
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount;

    container.scrollTo({ left: newScrollLeft, behavior: "smooth" });

    // Update button states after scroll
    setTimeout(checkScrollButtons, 100);
  };

  const loadTopics = async () => {
    try {
      setLoading(true);

      // Get latest week's topics
      const { data: latestWeek, error: weekError } = await supabase
        .from("trending_topics")
        .select("week_of")
        .order("week_of", { ascending: false })
        .limit(1)
        .single();

      if (weekError || !latestWeek) {
        console.error("Error fetching latest week:", weekError);
        setLoading(false);
        return;
      }

      // Fetch all topics for that week
      const { data, error } = await supabase
        .from("trending_topics")
        .select("*")
        .eq("week_of", latestWeek.week_of)
        .order("rank", { ascending: true });

      if (error) {
        console.error("Error loading topics:", error);
      } else {
        setTopics(data || []);
      }
    } catch (error) {
      console.error("Error loading topics:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort topics
  const filteredAndSortedTopics = useMemo(() => {
    let filtered = topics;

    // Category filter
    if (selectedCategory !== "All") {
      filtered = filtered.filter((topic) => topic.category === selectedCategory);
    }

    // Sort by rank (featured first, then rest)
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return a.rank - b.rank;
    });

    return sorted;
  }, [topics, selectedCategory]);

  const featuredTopics = filteredAndSortedTopics.filter((t) => t.is_featured);
  const allTopics = filteredAndSortedTopics;

  const getTopicText = (topic: TrendingTopic) =>
    isChineseMode && topic.title_zh ? topic.title_zh : topic.title_en;

  const handleSelectTopic = (topic: TrendingTopic) => {
    setPreviewTopic(null);
    setChoiceTopic(topic);
  };

  const handleCreateIsland = (topic: TrendingTopic) => {
    const topicText = getTopicText(topic);
    router.push(`/app/topic-islands?create=1&topic=${encodeURIComponent(topicText)}`);
  };

  const handleCreateJourney = (topic: TrendingTopic) => {
    const topicText = getTopicText(topic);
    router.push(`/app/journey/create?topic=${encodeURIComponent(topicText)}`);
  };

  if (loading) {
    return (
      <div className="relative min-h-screen px-6 py-4 md:px-16 md:py-8">
        <OceanBackground />
        <div className="relative z-10 flex min-h-[400px] items-center justify-center">
          <div className="text-gray-600">{t("Loading topics...")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen px-6 py-4 md:px-16 md:py-8">
      <OceanBackground />
      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900 md:text-4xl">
            {t("Browse Topics")}
          </h1>
          <p className="text-base text-gray-700 md:text-lg">
            {t("Pick something people actually talk about → build an island or a full journey.")}
          </p>
        </div>

        {/* Category Filter */}
        <div className="mb-8 space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
          {/* Header */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{t("Filter by category")}</h3>
            <p className="text-xs text-gray-600">{t("Select a category to narrow your results")}</p>
          </div>
          
          {/* Category Chips with Navigation - Mobile Scrollable */}
          <div className="relative">
            {/* Left Arrow */}
            {canScrollLeft && (
              <button
                onClick={() => scroll("left")}
                className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-gray-300 bg-white p-2 shadow-md transition-all hover:border-gray-900 hover:shadow-lg"
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-4 w-4 text-gray-700" />
              </button>
            )}

            {/* Scrollable Container */}
            <div
              ref={scrollContainerRef}
              onScroll={checkScrollButtons}
              className="overflow-x-auto pb-2 scrollbar-hide"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }}
            >
              <div className="flex gap-2 px-8">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                      selectedCategory === cat
                        ? "border-gray-900 bg-gray-900 text-white shadow-sm"
                        : "border-gray-300 bg-white text-gray-700 hover:border-gray-900 hover:shadow-sm"
                    }`}
                  >
                    {t(cat)}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Arrow */}
            {canScrollRight && (
              <button
                onClick={() => scroll("right")}
                className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-gray-300 bg-white p-2 shadow-md transition-all hover:border-gray-900 hover:shadow-lg"
                aria-label="Scroll right"
              >
                <ChevronRight className="h-4 w-4 text-gray-700" />
              </button>
            )}
          </div>
        </div>

        {/* Featured This Week */}
        {featuredTopics.length > 0 && selectedCategory === "All" && (
          <div className="mb-12">
            <h2 className="mb-4 text-2xl font-bold text-gray-900">{t("Trending this week")}</h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {featuredTopics.slice(0, 12).map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  onSelect={handleSelectTopic}
                  onPreview={setPreviewTopic}
                  showFeaturedBadge
                  isChineseMode={isChineseMode}
                  t={t}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Topics */}
        <div>
          <h2 className="mb-4 text-2xl font-bold text-gray-900">
            {selectedCategory !== "All" ? t("Results") : t("All topics")}
          </h2>

          {filteredAndSortedTopics.length === 0 ? (
            <div className="rounded-xl border-2 border-gray-300 bg-white p-12 text-center">
              <p className="text-gray-600">{t("No topics found. Try adjusting your filters.")}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {allTopics.slice(0, visibleCount).map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    onSelect={handleSelectTopic}
                    onPreview={setPreviewTopic}
                    isChineseMode={isChineseMode}
                    t={t}
                  />
                ))}
              </div>

              {/* Load More */}
              {visibleCount < allTopics.length && (
                <div className="mt-8 text-center">
                  <button
                    onClick={() => setVisibleCount((prev) => prev + 40)}
                    className="rounded-lg border-2 border-gray-900 bg-white px-6 py-3 font-bold text-gray-900 transition-colors hover:bg-gray-50"
                  >
                    {t("Load more")} ({allTopics.length - visibleCount} {t("remaining")})
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Preview Modal */}
        {previewTopic && (
          <PreviewModal
            topic={previewTopic}
            onClose={() => setPreviewTopic(null)}
            onSelect={handleSelectTopic}
            isChineseMode={isChineseMode}
            t={t}
          />
        )}

        {/* Island vs Journey choice */}
        {choiceTopic && (
          <PathChoiceModal
            topic={choiceTopic}
            onClose={() => setChoiceTopic(null)}
            onCreateIsland={handleCreateIsland}
            onCreateJourney={handleCreateJourney}
            isChineseMode={isChineseMode}
            t={t}
          />
        )}
      </div>
    </div>
  );
}

function TopicCard({
  topic,
  onSelect,
  onPreview,
  showFeaturedBadge = false,
  isChineseMode,
  t,
}: {
  topic: TrendingTopic;
  onSelect: (topic: TrendingTopic) => void;
  onPreview: (topic: TrendingTopic) => void;
  showFeaturedBadge?: boolean;
  isChineseMode: boolean;
  t: (key: string) => string;
}) {
  const displayTitle = isChineseMode && topic.title_zh ? topic.title_zh : topic.title_en;
  const displaySubtitle =
    isChineseMode && topic.title_zh ? topic.title_en : topic.title_zh;

  return (
    <div className="group relative flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-gray-900 hover:shadow-md">
      {/* Featured Badge */}
      {showFeaturedBadge && topic.is_featured && (
        <div className="absolute -top-2 -right-2 rounded-full border-2 border-cyan-400 bg-cyan-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-cyan-900">
          {t("Trending")}
        </div>
      )}

      {/* Title */}
      <div className="mb-3">
        <h3 className="mb-1 text-lg font-bold text-gray-900">{displayTitle}</h3>
        {displaySubtitle && (
          <p className="text-sm text-gray-600">{displaySubtitle}</p>
        )}
      </div>

      {/* Tags */}
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
          {t(topic.category)}
        </span>
        {topic.tags.slice(0, 2).map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Starter Prompts */}
      <div className="mb-4 flex-1">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {t("Conversation starters:")}
        </p>
        <ul className="space-y-1.5">
          {topic.starter_prompts.map((prompt, idx) => (
            <li key={idx} className="text-sm text-gray-700">
              • {prompt}
            </li>
          ))}
        </ul>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onSelect(topic)}
          className="flex-1 rounded-lg border-2 border-gray-900 bg-gray-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-gray-800"
        >
          {t("Start learning")}
        </button>
        <button
          onClick={() => onPreview(topic)}
          className="rounded-lg border-2 border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
        >
          {t("Preview")}
        </button>
      </div>
    </div>
  );
}

function PreviewModal({
  topic,
  onClose,
  onSelect,
  isChineseMode,
  t,
}: {
  topic: TrendingTopic;
  onClose: () => void;
  onSelect: (topic: TrendingTopic) => void;
  isChineseMode: boolean;
  t: (key: string) => string;
}) {
  const displayTitle = isChineseMode && topic.title_zh ? topic.title_zh : topic.title_en;
  const displaySubtitle =
    isChineseMode && topic.title_zh ? topic.title_en : topic.title_zh;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4">
          <h2 className="mb-2 text-2xl font-bold text-gray-900">{displayTitle}</h2>
          {displaySubtitle && (
            <p className="text-base text-gray-600">{displaySubtitle}</p>
          )}
        </div>

        {/* Tags */}
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700">
            {t(topic.category)}
          </span>
          {topic.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Starter Prompts */}
        <div className="mb-6">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t("Conversation starters:")}
          </p>
          <ul className="space-y-2">
            {topic.starter_prompts.map((prompt, idx) => (
              <li key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                {prompt}
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border-2 border-gray-300 bg-white px-4 py-2.5 text-base font-bold text-gray-700 transition-colors hover:bg-gray-50"
          >
            {t("Close")}
          </button>
          <button
            onClick={() => onSelect(topic)}
            className="flex-1 rounded-lg border-2 border-gray-900 bg-gray-900 px-4 py-2.5 text-base font-bold text-white transition-colors hover:bg-gray-800"
          >
            {t("Start learning")}
          </button>
        </div>
      </div>
    </div>
  );
}

function PathChoiceModal({
  topic,
  onClose,
  onCreateIsland,
  onCreateJourney,
  isChineseMode,
  t,
}: {
  topic: TrendingTopic;
  onClose: () => void;
  onCreateIsland: (topic: TrendingTopic) => void;
  onCreateJourney: (topic: TrendingTopic) => void;
  isChineseMode: boolean;
  t: (key: string) => string;
}) {
  const displayTitle = isChineseMode && topic.title_zh ? topic.title_zh : topic.title_en;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {t("How do you want to learn?")}
          </p>
          <h2 className="text-2xl font-bold text-gray-900">{displayTitle}</h2>
          <p className="mt-2 text-sm text-gray-600">
            {t("Choose a single focused lesson, or a multi-island learning path.")}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => onCreateIsland(topic)}
            className="flex items-start gap-4 rounded-xl border-2 border-gray-200 bg-white p-4 text-left transition-all hover:border-gray-900 hover:shadow-sm"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Layers className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">{t("Singular Island")}</p>
              <p className="mt-0.5 text-sm text-gray-600">
                {t("One topic lesson with vocab + examples. Quick and focused.")}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onCreateJourney(topic)}
            className="flex items-start gap-4 rounded-xl border-2 border-gray-200 bg-white p-4 text-left transition-all hover:border-gray-900 hover:shadow-sm"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Map className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-base font-bold text-gray-900">{t("Complete Journey")}</p>
              <p className="mt-0.5 text-sm text-gray-600">
                {t("A full path of islands and story checkpoints around this topic.")}
              </p>
            </div>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition-colors hover:bg-gray-50"
        >
          {t("Close")}
        </button>
      </div>
    </div>
  );
}
