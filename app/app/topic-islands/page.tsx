"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";

interface TopicIsland {
  id: string;
  topic: string;
  level: string;
  word_target: number;
  grammar_target?: number;
  status: string;
  created_at: string;
}

export default function TopicIslandsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useLanguage();
  const [islands, setIslands] = useState<TopicIsland[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    topic: "",
    level: "B1",
    wordTarget: 12,
     grammarTarget: 0,
     wantsGrammar: false,
  });

  useEffect(() => {
    loadIslands();
  }, []);

  const loadIslands = async () => {
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
  };

  const handleDelete = async (islandId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      !confirm(
        "Are you sure you want to delete this topic island? This will delete all words and sentences."
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
        throw new Error(
          errorData.details ||
            errorData.error ||
            "Failed to create topic island"
        );
      }

      const { islandId } = await response.json();

      // Start generation in the background (fire-and-forget)
      fetch(`/api/topic-islands/${islandId}/generate-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchSize: 5 }),
      }).catch((err) =>
        console.error("Error starting topic island generation:", err)
      );

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">
            {t("Topic Islands")}
          </h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg border border-gray-900 bg-white px-6 py-3 text-base font-medium uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-50"
          >
            {t("Create Topic Island")}
          </button>
        </div>

        {islands.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="mb-8 text-lg text-gray-600">
              Create your first topic island to start learning
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-lg border border-gray-900 bg-white px-8 py-4 text-base font-medium uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-50"
            >
              {t("Create Topic Island")}
            </button>
          </div>
        ) : (
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
                    {island.topic}
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
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-xl">
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
                    <option value="A2">A2 - Upper Beginner</option>
                    <option value="B1">B1 - Intermediate</option>
                    <option value="B2">B2 - Upper Intermediate</option>
                  </select>
                </div>

                <div className="mb-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <label className="block text-sm font-medium text-gray-900">
                        Focus on new grammar?
                      </label>
                      <p className="mt-1 text-xs text-gray-600">
                        If enabled, some example sentences will highlight new
                        patterns.
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
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
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
                        How many grammar patterns to focus on?
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

                <div className="mb-6">
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
        )}
      </div>
    </div>
  );
}
