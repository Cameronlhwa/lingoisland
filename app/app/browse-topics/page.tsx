"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/browser";
import { useLanguage } from "@/contexts/LanguageContext";
import { Layers, Map, Search } from "lucide-react";
import AppPageLoading from "@/components/app/AppPageLoading";
import { capybaraIslandSrcForTopic } from "@/lib/capybaraIslands";
import { hskLabelForCefr } from "@/lib/levelBands";

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

function topicArt(id: string, category: string) {
  return capybaraIslandSrcForTopic(id, category);
}

export default function BrowseTopicsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { isChineseMode, t } = useLanguage();

  const [topics, setTopics] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(40);
  const [previewTopic, setPreviewTopic] = useState<TrendingTopic | null>(null);
  const [choiceTopic, setChoiceTopic] = useState<TrendingTopic | null>(null);

  useEffect(() => {
    loadTopics();
  }, []);

  const loadTopics = async () => {
    try {
      setLoading(true);

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

  const filteredAndSortedTopics = useMemo(() => {
    let filtered = topics;
    const q = search.trim().toLowerCase();

    if (selectedCategory !== "All") {
      filtered = filtered.filter((topic) => topic.category === selectedCategory);
    }

    if (q) {
      filtered = filtered.filter((topic) => {
        const haystack = [
          topic.title_en,
          topic.title_zh ?? "",
          topic.category,
          ...topic.tags,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return a.rank - b.rank;
    });

    return sorted;
  }, [topics, selectedCategory, search]);

  const featuredTopics = filteredAndSortedTopics.filter((topic) => topic.is_featured);
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
    return <AppPageLoading label={t("Loading topics...")} />;
  }

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-8 md:px-6">
      <div className="mb-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-(--lingo-blue)">
          {t("Explore & Learn")}
        </p>
        <h1 className="lingo-display mt-1 max-w-2xl text-3xl font-bold text-(--lingo-navy) sm:text-4xl">
          {t("What do you want to talk about today?")}
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-(--lingo-text-muted)">
          {t("Find topics that match your interests, or discover something new.")}
        </p>
      </div>

      <div className="relative mb-5">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-(--lingo-text-muted)"
          aria-hidden
        />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisibleCount(40);
          }}
          placeholder={t("Search topics, tags, or categories…")}
          className="w-full rounded-2xl border bg-white py-3 pl-11 pr-4 text-sm text-(--lingo-text) placeholder:text-(--lingo-text-muted) focus:border-(--lingo-blue) focus:outline-hidden"
          style={{
            borderColor: "var(--lingo-border)",
            boxShadow: "var(--lingo-shadow-card)",
          }}
        />
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCategory(cat);
                setVisibleCount(40);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "bg-(--lingo-navy) text-white"
                  : "border bg-white text-(--lingo-navy) hover:bg-(--lingo-sky-pale)"
              }`}
              style={active ? undefined : { borderColor: "var(--lingo-border)" }}
            >
              {t(cat)}
            </button>
          );
        })}
      </div>

      {featuredTopics.length > 0 && selectedCategory === "All" && !search.trim() && (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="lingo-display text-xl font-bold text-(--lingo-navy)">
              {t("Trending this week")}
            </h2>
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{
                background: "#e7f7f5",
                color: "#0f766e",
                border: "1px solid #99f6e4",
              }}
            >
              {t("Trending")}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
        </section>
      )}

      <section>
        <h2 className="lingo-display mb-4 text-xl font-bold text-(--lingo-navy)">
          {selectedCategory !== "All" || search.trim() ? t("Results") : t("All topics")}
        </h2>

        {filteredAndSortedTopics.length === 0 ? (
          <div
            className="rounded-[28px] border bg-white px-6 py-12 text-center"
            style={{
              borderColor: "var(--lingo-border)",
              boxShadow: "var(--lingo-shadow-card)",
            }}
          >
            <p className="text-sm text-(--lingo-text-muted)">
              {t("No topics found. Try adjusting your filters.")}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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

            {visibleCount < allTopics.length && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 40)}
                  className="rounded-2xl bg-(--lingo-navy) px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-(--lingo-navy-soft)"
                >
                  {t("Load more")} ({allTopics.length - visibleCount} {t("remaining")})
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {previewTopic && (
        <PreviewModal
          topic={previewTopic}
          onClose={() => setPreviewTopic(null)}
          onSelect={handleSelectTopic}
          isChineseMode={isChineseMode}
          t={t}
        />
      )}

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
    <div
      className="group flex flex-col overflow-hidden rounded-[28px] border bg-white transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      style={{
        borderColor: "var(--lingo-border)",
        boxShadow: "var(--lingo-shadow-card)",
      }}
    >
      <div className="relative aspect-16/10 overflow-hidden bg-(--lingo-sky-pale)">
        <div className="relative h-full w-full px-3 py-2 transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
          <Image
            src={topicArt(topic.id, topic.category)}
            alt=""
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
        {showFeaturedBadge && topic.is_featured && (
          <span
            className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{
              background: "#e7f7f5",
              color: "#0f766e",
              border: "1px solid #99f6e4",
            }}
          >
            {t("Trending")}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-5 py-4">
        <h3 className="line-clamp-2 text-base font-bold leading-snug text-(--lingo-navy)">
          {displayTitle}
        </h3>
        {displaySubtitle && (
          <p className="mt-1 line-clamp-1 text-sm text-(--lingo-text-muted)">
            {displaySubtitle}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-(--lingo-navy)"
            style={{ background: "var(--lingo-sky-pale)" }}
          >
            {t(topic.category)}
          </span>
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-(--lingo-navy)"
            style={{ background: "var(--lingo-sky-pale)" }}
          >
            {hskLabelForCefr(topic.level)}
          </span>
          {topic.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-full border px-2.5 py-1 text-[11px] font-semibold text-(--lingo-text-muted)"
              style={{ borderColor: "var(--lingo-border)" }}
            >
              {tag}
            </span>
          ))}
        </div>

        {topic.starter_prompts.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {topic.starter_prompts.slice(0, 3).map((prompt, idx) => (
              <li
                key={idx}
                className="line-clamp-2 text-sm leading-relaxed text-(--lingo-text)"
              >
                {prompt}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={() => onSelect(topic)}
            className="flex-1 rounded-2xl bg-(--lingo-navy) px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-(--lingo-navy-soft)"
          >
            {t("Start learning")}
          </button>
          <button
            type="button"
            onClick={() => onPreview(topic)}
            className="rounded-2xl border bg-white px-4 py-2.5 text-sm font-bold text-(--lingo-navy) transition-colors hover:bg-(--lingo-sky-pale)"
            style={{ borderColor: "var(--lingo-border)" }}
          >
            {t("Preview")}
          </button>
        </div>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-[24px] border bg-white p-6"
        style={{
          borderColor: "var(--lingo-border)",
          boxShadow: "var(--lingo-shadow-card)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <h2 className="lingo-display text-2xl font-bold text-(--lingo-navy)">
            {displayTitle}
          </h2>
          {displaySubtitle && (
            <p className="mt-1 text-sm text-(--lingo-text-muted)">{displaySubtitle}</p>
          )}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <span
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-(--lingo-navy)"
            style={{ background: "var(--lingo-sky-pale)" }}
          >
            {t(topic.category)}
          </span>
          {topic.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border px-3 py-1.5 text-sm font-semibold text-(--lingo-text-muted)"
              style={{ borderColor: "var(--lingo-border)" }}
            >
              {tag}
            </span>
          ))}
        </div>

        <div className="mb-6">
          <ul className="space-y-2">
            {topic.starter_prompts.map((prompt, idx) => (
              <li
                key={idx}
                className="rounded-xl border bg-(--lingo-sky-pale) p-3 text-sm text-(--lingo-text)"
                style={{ borderColor: "var(--lingo-border)" }}
              >
                {prompt}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border bg-white px-4 py-2.5 text-sm font-bold text-(--lingo-navy) hover:bg-(--lingo-sky-pale)"
            style={{ borderColor: "var(--lingo-border)" }}
          >
            {t("Close")}
          </button>
          <button
            type="button"
            onClick={() => onSelect(topic)}
            className="flex-1 rounded-2xl bg-(--lingo-navy) px-4 py-2.5 text-sm font-bold text-white hover:bg-(--lingo-navy-soft)"
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-[24px] border bg-white p-6"
        style={{
          borderColor: "var(--lingo-border)",
          boxShadow: "var(--lingo-shadow-card)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-(--lingo-blue)">
            {t("How do you want to learn?")}
          </p>
          <h2 className="lingo-display mt-1 text-2xl font-bold text-(--lingo-navy)">
            {displayTitle}
          </h2>
          <p className="mt-2 text-sm text-(--lingo-text-muted)">
            {t("Choose a single focused lesson, or a multi-island learning path.")}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => onCreateIsland(topic)}
            className="flex items-start gap-4 rounded-2xl border bg-white p-4 text-left transition-colors hover:bg-(--lingo-sky-pale)"
            style={{ borderColor: "var(--lingo-border)" }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--lingo-sky-pale)", color: "var(--lingo-navy)" }}
            >
              <Layers className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-base font-bold text-(--lingo-navy)">{t("Singular Island")}</p>
              <p className="mt-0.5 text-sm text-(--lingo-text-muted)">
                {t("One topic lesson with vocab + examples. Quick and focused.")}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onCreateJourney(topic)}
            className="flex items-start gap-4 rounded-2xl border bg-white p-4 text-left transition-colors hover:bg-(--lingo-sky-pale)"
            style={{ borderColor: "var(--lingo-border)" }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--lingo-sky-pale)", color: "var(--lingo-navy)" }}
            >
              <Map className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-base font-bold text-(--lingo-navy)">{t("Complete Journey")}</p>
              <p className="mt-0.5 text-sm text-(--lingo-text-muted)">
                {t("A full path of islands and story checkpoints around this topic.")}
              </p>
            </div>
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-2xl border bg-white px-4 py-2.5 text-sm font-bold text-(--lingo-navy) hover:bg-(--lingo-sky-pale)"
          style={{ borderColor: "var(--lingo-border)" }}
        >
          {t("Close")}
        </button>
      </div>
    </div>
  );
}
