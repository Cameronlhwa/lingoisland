"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import ActivityCalendar from "@/components/app/ActivityCalendar";
import { useLanguage } from "@/contexts/LanguageContext";

interface TopicIsland {
  id: string;
  topic: string;
  level: string;
  word_target: number;
  status: string;
  created_at: string;
}

const STORAGE_KEY = "pending_topic_island_request";

export default function AppPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const { t } = useLanguage();
  const [topicIslands, setTopicIslands] = useState<TopicIsland[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIslandId, setSelectedIslandId] = useState<string | null>(
    searchParams.get("island")
  );
  const [currentPage, setCurrentPage] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  useEffect(() => {
    loadTopicIslands();
    handlePendingRequest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTopicIslands = async () => {
    const { data, error } = await supabase
      .from("topic_islands")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading topic islands:", error);
    } else {
      setTopicIslands(data || []);
      // If island param exists, ensure it's in the list
      const islandParam = searchParams.get("island");
      if (islandParam && data?.some((island) => island.id === islandParam)) {
        setSelectedIslandId(islandParam);
      }
    }
    setLoading(false);
  };

  const handlePendingRequest = async () => {
    // Check for pending topic island request from onboarding
    const pendingRequestStr = localStorage.getItem(STORAGE_KEY);
    if (!pendingRequestStr) return;

    try {
      const pendingRequest = JSON.parse(pendingRequestStr);

      // Mark as processing immediately to avoid duplicate handling in rare re-mount cases
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...pendingRequest, processing: true })
      );

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Update user profile with CEFR level if provided
      if (pendingRequest.cefrLevel) {
        await supabase
          .from("user_profiles")
          .update({ cefr_level: pendingRequest.cefrLevel })
          .eq("user_id", user.id);
      }

      // Create topic island via API

      const toBaseLevel = (
        level: string | null | undefined
      ): "A2" | "B1" | "B2" => {
        if (!level) return "B1";
        if (level.startsWith("A2")) return "A2";
        if (level.startsWith("B1")) return "B1";
        return "B2";
      };

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
        throw new Error("Failed to create topic island");
      }

      const { islandId } = await createResponse.json();

      // Start generation in the background (fire-and-forget).
      // The island detail page will show a loading state while content is generated.
      fetch(`/api/topic-islands/${islandId}/generate-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: 5 }),
      }).catch((err) =>
        console.error("Error starting topic island generation:", err)
      );

      // Clear pending request
      localStorage.removeItem(STORAGE_KEY);

      // Redirect to island detail page
      router.push(`/app/topic-islands/${islandId}`);
    } catch (error) {
      console.error("Error handling pending request:", error);
    }
  };

  const selectedIsland = topicIslands.find(
    (island) => island.id === selectedIslandId
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-8">
      <div className="mx-auto max-w-7xl">
        {/* Topic Islands Section */}
        {selectedIsland ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <h1 className="mb-4 text-3xl font-bold text-gray-900">
              {selectedIsland.topic}
            </h1>
            <div className="mb-8 space-y-2 text-gray-600">
              <p>
                <span className="font-medium">{t("Level")}:</span>{" "}
                {selectedIsland.level}
              </p>
              <p>
                <span className="font-medium">{t("Word target")}:</span>{" "}
                {selectedIsland.word_target} {t("words")}
              </p>
              <p>
                <span className="font-medium">{t("Status")}:</span>{" "}
                <span className="capitalize">
                  {t(selectedIsland.status) || selectedIsland.status}
                </span>
              </p>
              <p>
                <span className="font-medium">{t("Created")}:</span>{" "}
                {new Date(selectedIsland.created_at).toLocaleDateString()}
              </p>
            </div>
            <Link
              href={`/app/topic-islands/${selectedIsland.id}`}
              className="inline-block rounded-lg border border-gray-900 bg-gray-900 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800"
            >
              {t("View Island Details")} →
            </Link>
          </div>
        ) : topicIslands.length > 0 ? (
          <div>
            <h1 className="mb-6 text-2xl font-bold text-gray-900">
              {t("Your Topic Islands")}
            </h1>
            <div className="relative">
              {/* Navigation Arrows */}
              {topicIslands.length > 3 && (
                <>
                  <button
                    onClick={() => {
                      setCurrentPage((prev) => Math.max(0, prev - 1));
                    }}
                    disabled={currentPage === 0}
                    className="absolute left-0 top-1/2 z-10 -translate-x-4 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-2 shadow-md transition-all hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg
                      className="h-5 w-5 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      const maxPage = Math.ceil(topicIslands.length / 3) - 1;
                      setCurrentPage((prev) => Math.min(maxPage, prev + 1));
                    }}
                    disabled={
                      currentPage >= Math.ceil(topicIslands.length / 3) - 1
                    }
                    className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-4 rounded-full border border-gray-200 bg-white p-2 shadow-md transition-all hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg
                      className="h-5 w-5 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </>
              )}

              {/* Islands Container */}
              <div className="overflow-hidden">
                <div
                  className="flex transition-transform duration-300 ease-in-out"
                  style={{
                    transform: `translateX(-${currentPage * 100}%)`,
                  }}
                  onTouchStart={(e) =>
                    setTouchStart(e.targetTouches[0].clientX)
                  }
                  onTouchMove={(e) => setTouchEnd(e.targetTouches[0].clientX)}
                  onTouchEnd={() => {
                    if (!touchStart || !touchEnd) return;
                    const distance = touchStart - touchEnd;
                    const isLeftSwipe = distance > 50;
                    const isRightSwipe = distance < -50;
                    const maxPage = Math.ceil(topicIslands.length / 3) - 1;

                    if (isLeftSwipe && currentPage < maxPage) {
                      setCurrentPage((prev) => prev + 1);
                    }
                    if (isRightSwipe && currentPage > 0) {
                      setCurrentPage((prev) => prev - 1);
                    }
                  }}
                >
                  {Array.from({
                    length: Math.ceil(topicIslands.length / 3),
                  }).map((_, pageIndex) => (
                    <div
                      key={pageIndex}
                      className="grid min-w-full grid-cols-1 gap-4 md:grid-cols-3"
                    >
                      {topicIslands
                        .slice(pageIndex * 3, pageIndex * 3 + 3)
                        .map((island) => (
                          <button
                            key={island.id}
                            onClick={() => {
                              router.push(`/app/topic-islands/${island.id}`);
                            }}
                            className="rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
                          >
                            <h3 className="mb-2 text-xl font-bold text-gray-900">
                              {island.topic}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {island.word_target} words · {island.level}
                            </p>
                          </button>
                        ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Page Indicators */}
              {topicIslands.length > 3 && (
                <div className="mt-4 flex justify-center gap-2">
                  {Array.from({
                    length: Math.ceil(topicIslands.length / 3),
                  }).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentPage(index)}
                      className={`h-2 rounded-full transition-all ${
                        index === currentPage
                          ? "w-8 bg-gray-900"
                          : "w-2 bg-gray-300"
                      }`}
                      aria-label={`Go to page ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-20 shadow-sm">
            <h1 className="mb-4 text-3xl font-bold text-gray-900">
              {t("Create your first Topic Island")}
            </h1>
            <p className="mb-8 text-lg text-gray-600">
              {t("Start building vocabulary around topics you care about")}
            </p>
            <Link
              href="/app/topic-islands"
              className="rounded-lg border border-gray-900 bg-gray-900 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-gray-800"
            >
              {t("Create a Topic Island")}
            </Link>
          </div>
        )}

        {/* Activity Calendar Section */}
        <div className="mt-12">
          <ActivityCalendar />
        </div>
      </div>
    </div>
  );
}
