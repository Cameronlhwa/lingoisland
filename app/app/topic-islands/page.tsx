"use client";

import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import UpgradeModal from "@/components/app/UpgradeModal";
import { OceanBackground } from "@/components/OceanBackground";
import { coverUrlFromKey } from "@/lib/islandLibrary";
import { useSubscription } from "@/hooks/useSubscription";

interface TopicIsland {
  id: string;
  topic: string;
  level: string;
  word_target: number;
  grammar_target?: number;
  status: string;
  created_at: string;
  image_url?: string | null;
  cover_key?: string | null;
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
  const [deleting, setDeleting] = useState<string | null>(null);
  const [userDefaultLevel, setUserDefaultLevel] = useState<string>("B1");
  const [visibleCount, setVisibleCount] = useState(3); // Show 3 islands initially (1 on mobile via CSS)
  const [formData, setFormData] = useState({
    topic: "",
    level: "B1",
    wordTarget: 12,
    grammarTarget: 0,
    wantsGrammar: false,
    includeReviewVocab: false,
    reviewVocabMode: "random" as "random" | "select",
    selectedReviewIslands: [] as string[],
  });
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);


  const observerTarget = useRef<HTMLDivElement>(null);
  const didHydrateFromQuery = useRef(false);
  const topicFromQueryParams = useRef<string | null>(null);

  // Handle query params for modal control - SINGLE EFFECT
  useEffect(() => {
    console.log("[Topic Islands] Query params effect triggered");
    const createParam = searchParams.get("create");
    const topicParam = searchParams.get("topic");

    console.log("[Topic Islands] Params - create:", createParam, "topic:", topicParam, "didHydrate:", didHydrateFromQuery.current);

    if (createParam === "1") {
      if (!didHydrateFromQuery.current && topicParam) {
        // First time seeing these params - hydrate the form
        const decodedTopic = decodeURIComponent(topicParam);
        topicFromQueryParams.current = decodedTopic;
        console.log("[Topic Islands] Decoded topic:", decodedTopic);
        
        // Set form data with the topic - use functional update to ensure we get latest state
        setFormData({
          topic: decodedTopic,
          level: userDefaultLevel || "B1",
          wordTarget: 12,
          grammarTarget: 0,
          wantsGrammar: false,
          includeReviewVocab: false,
          reviewVocabMode: "random",
          selectedReviewIslands: [],
        });
        
        didHydrateFromQuery.current = true;
        console.log("[Topic Islands] Form data set to:", { topic: decodedTopic });
      }
      
      // Always open modal if create=1
      if (!showCreateModal) {
        console.log("[Topic Islands] Opening modal");
        setShowCreateModal(true);
      }
    }
  }, [searchParams, userDefaultLevel, showCreateModal]);

  useEffect(() => {
    if (subscriptionLoading) return;
    if (isPro) return;
    router.replace("/app?upgrade=1&feature=Topic%20Islands");
  }, [subscriptionLoading, isPro, router]);

  useEffect(() => {
    loadIslands();
    loadUserProfile();
  }, []);

  if (!subscriptionLoading && !isPro) {
    return null;
  }

  async function loadUserProfile() {
    try {
      const response = await fetch("/api/profile");
      if (response.ok) {
        const data = await response.json();
        const profileLevel = data.cefrLevel || "B1";
        setUserDefaultLevel(profileLevel);
        
        // Update form data with profile level if form is still at default
        setFormData(prev => ({
          ...prev,
          level: prev.level === "B1" ? profileLevel : prev.level,
        }));
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
    }
  }

  // Handle modal open/close and form reset
  useEffect(() => {
    if (!showCreateModal) {
      // Reset form when modal closes
      console.log("[Topic Islands] Modal closed - resetting form");
      setFormData({
        topic: "",
        level: userDefaultLevel,
        wordTarget: 12,
        grammarTarget: 0,
        wantsGrammar: false,
        includeReviewVocab: false,
        reviewVocabMode: "random",
        selectedReviewIslands: [],
      });
      didHydrateFromQuery.current = false;
      topicFromQueryParams.current = null;

      // Clean up query params from URL when modal closes
      if (searchParams.get("create") || searchParams.get("topic")) {
        router.replace(pathname, { scroll: false });
      }
    }
  }, [showCreateModal, userDefaultLevel, pathname, router, searchParams]);

  // Infinite scroll: load more islands automatically
  useEffect(() => {
    // Don't set up observer if still loading or no islands to observe
    if (loading || islands.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < islands.length) {
          // Load 3 more islands when user scrolls near bottom
          setVisibleCount((prev) => Math.min(prev + 3, islands.length));
        }
      },
      { threshold: 0.5 } // Only trigger when spinner is 50% visible (prevents immediate firing)
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [visibleCount, islands.length, loading]);

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

  const handleDelete = async (islandId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      !confirm(
        "Are you sure you want to delete this topic island? This will delete all words and sentences.",
      )
    ) {
      return;
    }

    setDeleting(islandId);
    try {
      const response = await fetch(`/api/topic-islands/${islandId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete island");
      }

      // Reload islands list
      await loadIslands();
    } catch (error) {
      console.error("Error deleting island:", error);
      alert("Failed to delete island. Please try again.");
    } finally {
      setDeleting(null);
    }
  };

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
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Check if this is a paywall error
        if (errorData.code === 'PAYWALL_ISLAND_LIMIT') {
          setShowCreateModal(false);
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

      const { islandId } = await response.json();

      // Prepare review vocab configuration
      const reviewVocabConfig = formData.includeReviewVocab
        ? {
            mode: formData.reviewVocabMode,
            islandIds:
              formData.reviewVocabMode === "select"
                ? formData.selectedReviewIslands
                : undefined,
          }
        : undefined;

      // Start generation in the background (fire-and-forget)
      fetch(`/api/topic-islands/${islandId}/generate-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchSize: 5,
          reviewVocab: reviewVocabConfig,
        }),
      }).catch((err) =>
        console.error("Error starting topic island generation:", err),
      );
      // Image generation disabled - using pre-generated library images for cost savings

      // Immediately navigate to island page; it will show loading/progress
      router.push(`/app/topic-islands/${islandId}`);
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

  const vPatternOffsets = [-72, 92, -72];
  const vJitter = [-10, 6, 14, -6, 12, -8];
  const sideOffsets = [-18, 22, -10, 16, -24, 12];

  return (
    <div className="relative min-h-screen px-6 py-4 md:px-16 md:py-8">
      <OceanBackground />
      <div className="relative z-10 mx-auto max-w-5xl">
        {/* Header - Always visible */}
        <div className="mb-6 md:mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {t("Topic Islands")}
          </h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg border-2 border-gray-900 bg-white px-5 md:px-6 py-2.5 md:py-3 text-sm md:text-base font-bold uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-50 shadow-[0_0_14px_3px_rgba(147,197,253,0.6)]"
          >
            {t("Create Topic Island")}
          </button>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-gray-600">{t("Loading...")}</div>
          </div>
        ) : islands.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="mb-8 text-lg text-gray-600">
              Create your first topic island to start learning
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-lg border-2 border-gray-900 bg-white px-8 py-4 text-base font-bold uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-50 shadow-[0_0_14px_3px_rgba(147,197,253,0.6)]"
            >
              {t("Create Topic Island")}
            </button>
          </div>
        ) : (
          <>
            {/* 
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {islands.map((island) => (
                <div
                  key={island.id}
                  className="group relative rounded-xl border border-gray-300 bg-white p-6 shadow-sm transition-all hover:border-gray-900 hover:bg-gray-50 hover:shadow-md"
                >
                  <Link
                    href={`/app/topic-islands/${island.id}`}
                    className="block"
                  >
                    <h3 className="mb-2 text-xl font-bold text-gray-900">
                      {convertText(island.topic)}
                    </h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>
                        {t("Level")}: {island.level}
                      </p>
                      <p>
                        {t("Word target")}: {island.word_target} {t("words")}
                      </p>
                      <p className="capitalize">
                        {t("Status")}: {t(island.status) || island.status}
                      </p>
                    </div>
                  </Link>
                  <button
                    onClick={(e) => handleDelete(island.id, e)}
                    disabled={deleting === island.id}
                    className="absolute right-4 top-4 text-sm text-gray-400 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100 disabled:opacity-50"
                    title="Delete island"
                  >
                    {deleting === island.id ? "Deleting..." : "×"}
                  </button>
                </div>
              ))}
            </div>
            */}
            <div className="pb-16 pt-24">
              <div className="grid grid-cols-1 justify-items-center gap-x-24 gap-y-24 md:grid-cols-2 lg:grid-cols-3">
                {islands.slice(0, visibleCount).map((island, sliceIndex) => {
                  // Track original index in full islands array
                  const originalIndex = islands.findIndex(i => i.id === island.id);
                  const offsetY =
                    vPatternOffsets[originalIndex % vPatternOffsets.length] +
                    vJitter[originalIndex % vJitter.length];
                  const offsetX = sideOffsets[originalIndex % sideOffsets.length];
                  // Use cover_key from library, fallback to image_url (legacy), then blank
                  const imageSrc = island.cover_key 
                    ? coverUrlFromKey(island.cover_key)
                    : island.image_url || "/blank_island.png";
                  const isDataUrl = imageSrc.startsWith("data:");
                  // On mobile (< md): only show first island via CSS so it works before JS hydration
                  const mobileHide = sliceIndex >= 1 ? "hidden md:block" : "";
                  return (
                    <Link
                      key={island.id}
                      href={`/app/topic-islands/${island.id}`}
                      className={`group relative block mx-10 md:mx-16 ${mobileHide}`}
                      style={{
                        transform: `translate(${offsetX}px, ${offsetY}px)`,
                      }}
                    >
                      <div className="flex flex-col items-center">
                        {/* Speech bubble title */}
                        <div className="relative mb-4 w-auto max-w-[90%] px-6 py-3 bg-white border-[3px] border-black rounded-2xl text-center">
                          <h3 className="text-base font-bold uppercase tracking-wide text-gray-900 md:text-lg leading-tight">
                            {convertText(island.topic)}
                          </h3>
                          {/* Speech bubble pointer */}
                          <div className="absolute left-1/2 -bottom-3 -translate-x-1/2 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[12px] border-t-black" />
                          <div className="absolute left-1/2 -bottom-[9px] -translate-x-1/2 w-0 h-0 border-l-[9px] border-l-transparent border-r-[9px] border-r-transparent border-t-[9px] border-t-white" />
                        </div>
                        <div className="relative h-56 w-96 md:h-64 md:w-[26rem] transition-transform duration-250 ease-out will-change-transform group-hover:scale-[1.03]">
                          <Image
                            src={imageSrc}
                            alt={convertText(island.topic)}
                            fill
                            className="object-contain"
                            priority={originalIndex < 3}
                            loading={originalIndex < 3 ? "eager" : "lazy"}
                            unoptimized={isDataUrl}
                          />
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              
              {/* Loading spinner - shows when more islands available; hidden on mobile (md and up only) */}
              {visibleCount < islands.length && (
                <div ref={observerTarget} className="mt-32 hidden md:flex justify-center py-12 min-h-[200px]">
                  <div className="flex flex-col items-center gap-3">
                    {/* Animated spinner matching ocean theme */}
                    <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-black border-t-transparent" />
                    <div className="text-gray-600 text-sm font-medium">
                      {t("Loading more islands...")}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Create Modal */}
        {showCreateModal && (() => {
          console.log("[Topic Islands] Rendering modal with formData.topic:", formData.topic);
          return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 md:p-8 shadow-xl">
              <h2 className="mb-6 text-2xl font-bold text-gray-900">
                {t("Create Topic Island")}
              </h2>
              <form onSubmit={handleCreate}>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Topic
                  </label>
                  <input
                    type="text"
                    value={formData.topic}
                    onChange={(e) =>
                      setFormData({ ...formData, topic: e.target.value })
                    }
                    placeholder="e.g., Cooking, Travel, Business"
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-gray-900 focus:outline-none"
                    required
                  />
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Level
                  </label>
                  <select
                    value={formData.level}
                    onChange={(e) =>
                      setFormData({ ...formData, level: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-gray-900 focus:outline-none"
                  >
                    <option value="A1">A1 - Beginner</option>
                    <option value="A2">A2 - Elementary</option>
                    <option value="B1">B1 - Intermediate</option>
                    <option value="B2">B2 - Upper Intermediate</option>
                    <option value="C1">C1 - Advanced</option>
                  </select>
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Word Count: {formData.wordTarget}
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="20"
                    value={formData.wordTarget}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        wordTarget: parseInt(e.target.value),
                      })
                    }
                    className="w-full"
                  />
                  <div className="mt-1 flex justify-between text-xs text-gray-500">
                    <span>10</span>
                    <span>20</span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-900">
                        Include new grammar pattern teaching?
                      </label>
                      <p className="mt-1 text-xs text-gray-600">
                        Learn new native grammar structures that are useful for
                        your desired topic.
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
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                        formData.wantsGrammar ? "bg-gray-900" : "bg-gray-300"
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
                      <p className="mb-2 text-sm font-medium text-gray-900">
                        How many grammar patterns to teach?
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
                            className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                              formData.grammarTarget === count
                                ? "border-gray-900 bg-gray-900 text-white"
                                : "border-gray-300 bg-white text-gray-900 hover:border-gray-900"
                            }`}
                          >
                            {count}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Review Vocabulary Section */}
                {islands.length > 0 && (
                  <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-900">
                          Include review vocabulary?
                        </label>
                        <p className="mt-1 text-xs text-gray-600">
                          Example sentences will use words from your other
                          islands along with the new words for reinforcement.
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
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                          formData.includeReviewVocab
                            ? "bg-gray-900"
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
                            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                              formData.reviewVocabMode === "random"
                                ? "border-gray-900 bg-gray-900 text-white"
                                : "border-gray-300 bg-white text-gray-900 hover:border-gray-900"
                            }`}
                          >
                            Random
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                reviewVocabMode: "select",
                              }))
                            }
                            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                              formData.reviewVocabMode === "select"
                                ? "border-gray-900 bg-gray-900 text-white"
                                : "border-gray-300 bg-white text-gray-900 hover:border-gray-900"
                            }`}
                          >
                            Select Islands
                          </button>
                        </div>

                        {formData.reviewVocabMode === "select" && (
                          <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-gray-200 bg-white p-3">
                            {islands.length === 0 ? (
                              <p className="text-xs text-gray-500">
                                No other islands available
                              </p>
                            ) : (
                              islands.map((island) => (
                                <label
                                  key={island.id}
                                  className="flex cursor-pointer items-center gap-2 rounded p-1.5 hover:bg-gray-50"
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
                                    className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-2 focus:ring-gray-900"
                                  />
                                  <span className="flex-1 text-sm text-gray-900">
                                    {convertText(island.topic)}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {island.level}
                                  </span>
                                </label>
                              ))
                            )}
                          </div>
                        )}

                        {formData.reviewVocabMode === "random" && (
                          <p className="text-xs text-gray-600">
                            Words will be randomly selected from all your other
                            islands.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-base text-gray-700 transition-colors hover:bg-gray-50"
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-lg border border-gray-900 bg-white px-4 py-2 text-base font-medium text-gray-900 transition-colors hover:bg-gray-50"
                    disabled={creating}
                  >
                    {creating ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
          );
        })()}

        {/* Upgrade Modal */}
        <UpgradeModal 
          open={showUpgradeModal} 
          onClose={() => setShowUpgradeModal(false)}
          feature="Create Topic Island (monthly limit reached)"
        />
      </div>
    </div>
  );
}
