"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { BookOpen, CheckCircle2, ChevronRight, Layers, Plus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import UpgradeModal from "@/components/app/UpgradeModal";
import { capybaraIslandSrc } from "@/lib/capybaraIslands";
import { useSubscription } from "@/hooks/useSubscription";
import {
  SENTENCE_STYLE_OPTIONS,
  type SentenceStyle,
} from "@/lib/sentenceStyle";
import { PROFILE_LEVEL_OPTIONS } from "@/lib/levelBands";
import { hskLabelForCefr } from "@/lib/levelBands";
import AppPageLoading from "@/components/app/AppPageLoading";

interface TopicIsland {
  id: string;
  topic: string;
  level: string;
  word_target: number;
  words_selected?: number;
  grammar_target?: number;
  status: string;
  created_at: string;
  image_url?: string | null;
  cover_key?: string | null;
}

function islandDetailHref(island: TopicIsland): string {
  const wordCount = island.words_selected ?? island.word_target;
  if (island.status === "ready" && wordCount >= 5) {
    return `/app/topic-islands/${island.id}/learn/preparing`;
  }
  return `/app/topic-islands/${island.id}`;
}

function islandImageSrc(island: TopicIsland): string {
  return capybaraIslandSrc(island.id);
}

function statusLabel(status: string): string | null {
  switch (status) {
    case "ready":
      return "Ready";
    case "draft":
      return "Draft";
    case "selecting":
    case "generating":
      return "Generating";
    case "error":
      return "Needs attention";
    default:
      return null;
  }
}

function CreateIslandButton({
  onClick,
  label,
  className = "",
}: {
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 rounded-2xl bg-(--lingo-navy) px-5 py-3 text-sm font-bold text-white shadow-xs transition-colors hover:bg-(--lingo-navy-soft) ${className}`}
    >
      <Plus size={16} aria-hidden />
      {label}
    </button>
  );
}

function IslandCard({
  island,
  topic,
  priority,
}: {
  island: TopicIsland;
  topic: string;
  priority?: boolean;
}) {
  const { t } = useLanguage();
  const imageSrc = islandImageSrc(island);
  const wordsOnIsland = island.words_selected ?? 0;
  const wordMeta =
    wordsOnIsland > 0
      ? `${wordsOnIsland} ${t("words")}`
      : island.status === "ready"
        ? `${island.word_target} ${t("words")}`
        : null;
  const levelLabel = hskLabelForCefr(island.level);
  const status = statusLabel(island.status);
  const showStatus = status && status !== "Ready";

  return (
    <Link
      href={islandDetailHref(island)}
      className="group block overflow-hidden rounded-[28px] border bg-white transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      style={{
        borderColor: "var(--lingo-border)",
        boxShadow: "var(--lingo-shadow-card)",
      }}
    >
      <div className="relative aspect-16/10 overflow-hidden bg-(--lingo-sky-pale) px-4 py-3">
        <div className="relative h-full w-full transition-transform duration-300 ease-out will-change-transform group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100">
          <Image
            src={imageSrc}
            alt={topic}
            fill
            className="object-contain"
            priority={priority}
            loading={priority ? "eager" : "lazy"}
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
        {showStatus && (
          <span
            className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{
              background: status === "Needs attention" ? "#fdecea" : "#eef9fc",
              color: status === "Needs attention" ? "#9f1c14" : "var(--lingo-navy)",
              border: `1px solid ${status === "Needs attention" ? "#f5c2c0" : "var(--lingo-border)"}`,
            }}
          >
            {t(status)}
          </span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-(--lingo-navy)">
            {topic}
          </h3>
          <p className="mt-1 truncate text-sm text-(--lingo-text-muted)">
            {[levelLabel, wordMeta].filter(Boolean).join(" · ")}
          </p>
        </div>
        <ChevronRight
          size={18}
          className="mt-0.5 shrink-0 text-(--lingo-blue) transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
          aria-hidden
        />
      </div>
    </Link>
  );
}

export default function TopicIslandsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();
  const { isPro, isLoading: subscriptionLoading } = useSubscription();
  const [islands, setIslands] = useState<TopicIsland[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [userDefaultLevel, setUserDefaultLevel] = useState<string>("B1");
  const [formData, setFormData] = useState({
    topic: "",
    level: "B1",
    wordTarget: 12,
    grammarTarget: 0,
    wantsGrammar: false,
    sentenceStyle: "casual" as SentenceStyle,
    includeReviewVocab: false,
    reviewVocabMode: "random" as "random" | "select",
    selectedReviewIslands: [] as string[],
  });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const didHydrateFromQuery = useRef(false);
  // Set when the user dismisses the modal while ?create=1 is still in the URL.
  // The open effect would otherwise see the stale query and pop the modal back open.
  const ignoreCreateQuery = useRef(false);

  useEffect(() => {
    if (subscriptionLoading) return;
    if (isPro) return;
    router.replace("/app?upgrade=1&feature=Topic%20Islands");
  }, [subscriptionLoading, isPro, router]);

  useEffect(() => {
    loadIslands();
    loadUserProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const createParam = searchParams.get("create");
    if (createParam !== "1") {
      ignoreCreateQuery.current = false;
      return;
    }
    if (ignoreCreateQuery.current) return;

    const topicParam = searchParams.get("topic");
    if (!didHydrateFromQuery.current) {
      const decodedTopic = topicParam ? decodeURIComponent(topicParam) : "";
      setFormData((prev) => ({
        ...prev,
        topic: decodedTopic || prev.topic,
        level: prev.level === "B1" ? userDefaultLevel || "B1" : prev.level,
      }));
      didHydrateFromQuery.current = true;
    }

    setShowCreateModal(true);
  }, [searchParams, userDefaultLevel]);

  async function loadUserProfile() {
    try {
      const response = await fetch("/api/profile");
      if (response.ok) {
        const data = await response.json();
        const profileLevel = data.cefrLevel || "B1";
        setUserDefaultLevel(profileLevel);

        setFormData((prev) => ({
          ...prev,
          level: prev.level === "B1" ? profileLevel : prev.level,
        }));
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  }

  function resetCreateForm() {
    setFormData({
      topic: "",
      level: userDefaultLevel,
      wordTarget: 12,
      grammarTarget: 0,
      wantsGrammar: false,
      sentenceStyle: "casual",
      includeReviewVocab: false,
      reviewVocabMode: "random",
      selectedReviewIslands: [],
    });
    didHydrateFromQuery.current = false;
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    resetCreateForm();
    if (searchParams.get("create") || searchParams.get("topic")) {
      ignoreCreateQuery.current = true;
      router.replace(pathname, { scroll: false });
    }
  }

  if (!subscriptionLoading && !isPro) {
    return null;
  }

  async function loadIslands() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("topic_islands")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setIslands(data);
    }
    setLoading(false);
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const grammarTarget = formData.wantsGrammar ? formData.grammarTarget : 0;

      const response = await fetch("/api/topic-islands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: formData.topic,
          level: formData.level,
          wordTarget: formData.wordTarget,
          grammarTarget,
          sentenceStyle: formData.sentenceStyle,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (errorData.code === "PAYWALL_ISLAND_LIMIT") {
          closeCreateModal();
          setShowUpgradeModal(true);
          setCreating(false);
          return;
        }

        throw new Error(
          errorData.details ||
            errorData.error ||
            "Failed to create topic island",
        );
      }

      const { islandId, sentenceStyle } = await response.json();

      const reviewVocabConfig = formData.includeReviewVocab
        ? {
            mode: formData.reviewVocabMode,
            islandIds:
              formData.reviewVocabMode === "select"
                ? formData.selectedReviewIslands
                : undefined,
          }
        : undefined;

      const preparationParams = new URLSearchParams({
        sentenceStyle: sentenceStyle ?? formData.sentenceStyle,
      });
      if (reviewVocabConfig) {
        preparationParams.set("reviewVocab", JSON.stringify(reviewVocabConfig));
      }
      router.push(
        `/app/topic-islands/${islandId}/learn/preparing?${preparationParams.toString()}`,
      );
    } catch (error) {
      console.error("Error creating island:", error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to create topic island. Please try again.";
      alert(errorMessage);
      setCreating(false);
    }
  };

  if (loading) {
    return <AppPageLoading label={t("Loading...")} />;
  }

  const readyCount = islands.filter((island) => island.status === "ready").length;
  const wordsAcrossIslands = islands.reduce(
    (sum, island) => sum + (island.words_selected ?? 0),
    0,
  );
  const createLabel = t("Create Topic Island");

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-8 md:px-6">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-(--lingo-blue)">
            {t("My Islands")}
          </p>
          <h1 className="lingo-display mt-1 max-w-xl text-3xl font-bold text-(--lingo-navy) sm:text-4xl">
            {t("Your Islands")}
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-(--lingo-text-muted)">
            {t("Keep exploring new topics and build your confidence step by step.")}
          </p>
        </div>
        <CreateIslandButton onClick={() => setShowCreateModal(true)} label={createLabel} />
      </div>

      {islands.length > 0 && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: t("Islands"), value: islands.length, icon: Layers },
            { label: t("Ready to practice"), value: readyCount, icon: CheckCircle2 },
            { label: t("Words"), value: wordsAcrossIslands, icon: BookOpen },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-[28px] border bg-white px-5 py-4"
              style={{
                borderColor: "var(--lingo-border)",
                boxShadow: "var(--lingo-shadow-card)",
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-2xl"
                  style={{ background: "var(--lingo-sky-pale)", color: "var(--lingo-navy)" }}
                >
                  <stat.icon size={16} aria-hidden />
                </span>
                <div>
                  <p className="lingo-display text-2xl font-bold leading-none text-(--lingo-navy)">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-(--lingo-text-muted)">
                    {stat.label}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {islands.length === 0 ? (
        <div
          className="mx-auto flex max-w-lg flex-col items-center rounded-[28px] border bg-white px-6 py-12 text-center"
          style={{
            borderColor: "var(--lingo-border)",
            boxShadow: "var(--lingo-shadow-card)",
          }}
        >
          <div className="relative mb-5 h-36 w-full max-w-[260px]">
            <Image
              src="/capybara-islands/cottage.png"
              alt=""
              fill
              className="object-contain"
              sizes="260px"
            />
          </div>
          <h2 className="lingo-display text-xl font-bold text-(--lingo-navy)">
            {t("Create your first island")}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-(--lingo-text-muted)">
            {t("Pick a topic you care about and we'll build vocabulary and native example sentences around it.")}
          </p>
          <CreateIslandButton
            onClick={() => setShowCreateModal(true)}
            label={createLabel}
            className="mt-6"
          />
        </div>
      ) : (
        <section>
          <h2 className="lingo-display mb-4 text-xl font-bold text-(--lingo-navy)">
            {t("Your islands")}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {islands.map((island, index) => (
              <IslandCard
                key={island.id}
                island={island}
                topic={convertText(island.topic)}
                priority={index < 3}
              />
            ))}
          </div>
        </section>
      )}

      {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
            <div
              className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[24px] border bg-white p-5 md:p-8"
              style={{
                borderColor: "var(--lingo-border)",
                boxShadow: "var(--lingo-shadow-card)",
              }}
            >
              <h2 className="lingo-display mb-6 text-2xl font-bold text-(--lingo-navy)">
                {t("Create Topic Island")}
              </h2>
              <form onSubmit={handleCreate}>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-(--lingo-navy)">
                    {t("Topic")}
                  </label>
                  <input
                    type="text"
                    value={formData.topic}
                    onChange={(e) => {
                      const topic = e.target.value;
                      setFormData((prev) => ({ ...prev, topic }));
                    }}
                    placeholder={t("e.g., Cooking, Travel, Business")}
                    className="w-full rounded-xl border bg-white px-4 py-2.5 text-(--lingo-text) focus:border-(--lingo-blue) focus:outline-hidden"
                    style={{ borderColor: "var(--lingo-border)" }}
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-(--lingo-navy)">
                    {t("Level")}
                  </label>
                  <select
                    value={formData.level}
                    onChange={(e) => {
                      const level = e.target.value;
                      setFormData((prev) => ({ ...prev, level }));
                    }}
                    className="w-full rounded-xl border bg-white px-4 py-2.5 text-(--lingo-text) focus:border-(--lingo-blue) focus:outline-hidden"
                    style={{ borderColor: "var(--lingo-border)" }}
                  >
                    {PROFILE_LEVEL_OPTIONS.map((opt) => (
                      <option key={opt.cefr} value={opt.cefr}>
                        HSK {opt.hsk} - {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-(--lingo-navy)">
                    {t("Word Count:")} {formData.wordTarget}
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="20"
                    value={formData.wordTarget}
                    onChange={(e) => {
                      const wordTarget = parseInt(e.target.value, 10);
                      setFormData((prev) => ({ ...prev, wordTarget }));
                    }}
                    className="w-full"
                  />
                  <div className="mt-1 flex justify-between text-xs text-(--lingo-text-muted)">
                    <span>10</span>
                    <span>20</span>
                  </div>
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-(--lingo-navy)">
                    {t("Example sentences")}
                  </label>
                  <p className="mb-3 text-xs text-(--lingo-text-muted)">
                    {t("Choose the tone for the example sentences on this island.")}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {SENTENCE_STYLE_OPTIONS.map((option) => {
                      const active = formData.sentenceStyle === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              sentenceStyle: option.value,
                            }))
                          }
                          className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                            active
                              ? "bg-(--lingo-navy) text-white"
                              : "bg-white text-(--lingo-navy) hover:bg-(--lingo-sky-pale)"
                          }`}
                          style={{
                            borderColor: active
                              ? "var(--lingo-navy)"
                              : "var(--lingo-border)",
                          }}
                        >
                          <span className="block text-sm font-semibold">
                            {t(option.label)}
                          </span>
                          <span
                            className={`mt-1 block text-xs ${
                              active ? "text-white/70" : "text-(--lingo-text-muted)"
                            }`}
                          >
                            {t(option.description)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-(--lingo-navy)">
                        {t("Include new grammar pattern teaching?")}
                      </label>
                      <p className="mt-1 text-xs text-(--lingo-text-muted)">
                        {t("Learn new native grammar structures that are useful for your desired topic.")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          wantsGrammar: !prev.wantsGrammar,
                        }))
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                        formData.wantsGrammar
                          ? "bg-(--lingo-navy)"
                          : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          formData.wantsGrammar
                            ? "translate-x-5"
                            : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>

                  {formData.wantsGrammar && (
                    <div className="mt-2">
                      <p className="mb-2 text-sm font-medium text-(--lingo-navy)">
                        {t("How many grammar patterns to teach?")}
                      </p>
                      <div className="flex gap-2">
                        {[1, 2, 3].map((count) => (
                          <button
                            key={count}
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                grammarTarget: count,
                              }))
                            }
                            className={`flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                              formData.grammarTarget === count
                                ? "bg-(--lingo-navy) text-white"
                                : "bg-white text-(--lingo-navy) hover:bg-(--lingo-sky-pale)"
                            }`}
                            style={{
                              borderColor:
                                formData.grammarTarget === count
                                  ? "var(--lingo-navy)"
                                  : "var(--lingo-border)",
                            }}
                          >
                            {count}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {islands.length > 0 && (
                  <div
                    className="mb-6 rounded-xl border bg-(--lingo-sky-pale) p-4"
                    style={{ borderColor: "var(--lingo-border)" }}
                  >
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-(--lingo-navy)">
                          {t("Include review vocabulary?")}
                        </label>
                        <p className="mt-1 text-xs text-(--lingo-text-muted)">
                          {t("Example sentences will use words from your other islands along with the new words for reinforcement.")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            includeReviewVocab: !prev.includeReviewVocab,
                            selectedReviewIslands: [],
                          }))
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                          formData.includeReviewVocab
                            ? "bg-(--lingo-navy)"
                            : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            formData.includeReviewVocab
                              ? "translate-x-5"
                              : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>

                    {formData.includeReviewVocab && (
                      <div className="mt-4 space-y-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                reviewVocabMode: "random",
                                selectedReviewIslands: [],
                              }))
                            }
                            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                              formData.reviewVocabMode === "random"
                                ? "bg-(--lingo-navy) text-white"
                                : "bg-white text-(--lingo-navy)"
                            }`}
                            style={{
                              borderColor:
                                formData.reviewVocabMode === "random"
                                  ? "var(--lingo-navy)"
                                  : "var(--lingo-border)",
                            }}
                          >
                            {t("Random")}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                reviewVocabMode: "select",
                              }))
                            }
                            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                              formData.reviewVocabMode === "select"
                                ? "bg-(--lingo-navy) text-white"
                                : "bg-white text-(--lingo-navy)"
                            }`}
                            style={{
                              borderColor:
                                formData.reviewVocabMode === "select"
                                  ? "var(--lingo-navy)"
                                  : "var(--lingo-border)",
                            }}
                          >
                            {t("Select Islands")}
                          </button>
                        </div>

                        {formData.reviewVocabMode === "select" && (
                          <div className="max-h-40 space-y-2 overflow-y-auto rounded-xl border bg-white p-3" style={{ borderColor: "var(--lingo-border)" }}>
                            {islands.length === 0 ? (
                              <p className="text-xs text-(--lingo-text-muted)">
                                {t("No other islands available")}
                              </p>
                            ) : (
                              islands.map((island) => (
                                <label
                                  key={island.id}
                                  className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 hover:bg-(--lingo-sky-pale)"
                                >
                                  <input
                                    type="checkbox"
                                    checked={formData.selectedReviewIslands.includes(
                                      island.id,
                                    )}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setFormData((prev) => ({
                                          ...prev,
                                          selectedReviewIslands: [
                                            ...prev.selectedReviewIslands,
                                            island.id,
                                          ],
                                        }));
                                      } else {
                                        setFormData((prev) => ({
                                          ...prev,
                                          selectedReviewIslands:
                                            prev.selectedReviewIslands.filter(
                                              (id) => id !== island.id,
                                            ),
                                        }));
                                      }
                                    }}
                                    className="h-4 w-4 rounded-sm border-gray-300 text-(--lingo-navy) focus:ring-2 focus:ring-(--lingo-blue)"
                                  />
                                  <span className="flex-1 text-sm text-(--lingo-navy)">
                                    {convertText(island.topic)}
                                  </span>
                                  <span className="text-xs text-(--lingo-text-muted)">
                                    {hskLabelForCefr(island.level)}
                                  </span>
                                </label>
                              ))
                            )}
                          </div>
                        )}

                        {formData.reviewVocabMode === "random" && (
                          <p className="text-xs text-(--lingo-text-muted)">
                            {t("Words will be randomly selected from all your other islands.")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeCreateModal}
                    className="flex-1 rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-(--lingo-navy) transition-colors hover:bg-(--lingo-sky-pale)"
                    style={{ borderColor: "var(--lingo-border)" }}
                    disabled={creating}
                  >
                    {t("Cancel")}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-2xl bg-(--lingo-navy) px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-(--lingo-navy-soft) disabled:opacity-60"
                    disabled={creating}
                  >
                    {creating ? t("Creating...") : t("Create")}
                  </button>
                </div>
              </form>
            </div>
          </div>
      )}

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature="Create Topic Island (monthly limit reached)"
      />
    </div>
  );
}
