"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import { OceanBackground } from "@/components/OceanBackground";
import { useSubscription } from "@/hooks/useSubscription";

interface QuizIsland {
  id: string;
  name: string;
  created_at: string;
  card_count: number;
}

export default function QuizIslandsPage() {
  const router = useRouter();
  const { convertText } = useCharacterSet();
  const { isPro, isLoading: subscriptionLoading } = useSubscription();
  const [quizIslands, setQuizIslands] = useState<QuizIsland[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newIslandName, setNewIslandName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingIslandId, setDeletingIslandId] = useState<string | null>(null);

  useEffect(() => {
    if (subscriptionLoading) return;
    if (isPro) return;
    router.replace("/app?upgrade=1&feature=Quiz%20Islands");
  }, [subscriptionLoading, isPro, router]);

  useEffect(() => {
    loadQuizIslands();
  }, []);

  if (!subscriptionLoading && !isPro) {
    return null;
  }

  const loadQuizIslands = async () => {
    try {
      const response = await fetch("/api/quiz-islands");
      if (!response.ok) throw new Error("Failed to load quiz islands");
      const data = await response.json();
      setQuizIslands(data.quizIslands || []);
    } catch (error) {
      console.error("Error loading quiz islands:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIslandName.trim()) return;

    setCreating(true);
    try {
      const response = await fetch("/api/quiz-islands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newIslandName.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create quiz island");
      }

      const data = await response.json();
      setShowCreateModal(false);
      setNewIslandName("");
      // Navigate to the new quiz island
      router.push(`/app/quiz/${data.quizIsland.id}`);
    } catch (error) {
      console.error("Error creating quiz island:", error);
      alert(
        error instanceof Error ? error.message : "Failed to create quiz island"
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (islandId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this quiz island? This will also delete all cards in it."
      )
    ) {
      return;
    }

    setDeletingIslandId(islandId);
    try {
      const response = await fetch(`/api/quiz-islands?quizIslandId=${islandId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete quiz island");
      }

      setQuizIslands(quizIslands.filter((island) => island.id !== islandId));
    } catch (error) {
      console.error("Error deleting quiz island:", error);
      alert(
        error instanceof Error ? error.message : "Failed to delete quiz island"
      );
    } finally {
      setDeletingIslandId(null);
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
    <div className="relative min-h-screen p-4 md:p-8">
      <OceanBackground />
      <div className="relative z-10 mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 md:mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Quiz
          </h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg border-2 border-gray-900 bg-white px-5 md:px-6 py-2.5 md:py-3 text-sm md:text-base font-bold uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-50 shadow-[0_0_14px_3px_rgba(147,197,253,0.6)]"
          >
            Create Quiz Island
          </button>
        </div>

        {/* Empty State */}
        {quizIslands.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="mb-8 text-lg text-gray-600">
              Create your first quiz island to start practicing
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-lg border-2 border-gray-900 bg-white px-8 py-4 text-base font-bold uppercase tracking-wide text-gray-900 transition-colors hover:bg-gray-50 shadow-[0_0_14px_3px_rgba(147,197,253,0.6)]"
            >
              Create Quiz Island
            </button>
          </div>
        ) : (
          /* Islands List */
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quizIslands.map((island) => (
              <div
                key={island.id}
                className="group relative rounded-xl border border-gray-300 bg-white p-6 shadow-sm transition-all hover:border-gray-900 hover:bg-gray-50 hover:shadow-md"
              >
                <Link href={`/app/quiz/${island.id}`} className="block">
                  <h3 className="mb-2 text-xl font-bold text-gray-900">
                    {convertText(island.name)}
                  </h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>
                      Chinese • {island.card_count} card
                      {island.card_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(island.id);
                  }}
                  disabled={deletingIslandId === island.id}
                  className="absolute right-4 top-4 text-sm text-gray-400 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100 disabled:opacity-50"
                  title="Delete island"
                >
                  {deletingIslandId === island.id ? "Deleting..." : "×"}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-5 md:p-8 shadow-xl">
              <h2 className="mb-6 text-2xl font-bold text-gray-900">
                Create Quiz Island
              </h2>
              <form onSubmit={handleCreate}>
                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium text-gray-900">
                    Name
                  </label>
                  <input
                    type="text"
                    value={newIslandName}
                    onChange={(e) => setNewIslandName(e.target.value)}
                    placeholder="e.g., Basic Vocabulary"
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-gray-900 focus:outline-none"
                    required
                    autoFocus
                  />
                  <p className="mt-1 text-xs text-gray-600">
                    Quiz islands are for Chinese practice only
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewIslandName("");
                    }}
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-base text-gray-700 transition-colors hover:bg-gray-50"
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newIslandName.trim()}
                    className="flex-1 rounded-lg border border-gray-900 bg-white px-4 py-2 text-base font-medium text-gray-900 transition-colors hover:bg-gray-50 disabled:opacity-50"
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
