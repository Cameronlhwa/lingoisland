"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface QuizIsland {
  id: string;
  name: string;
  created_at: string;
  card_count: number;
}

export default function QuizIslandsPage() {
  const router = useRouter();
  const [quizIslands, setQuizIslands] = useState<QuizIsland[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newIslandName, setNewIslandName] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadQuizIslands();
  }, []);

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
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
          <span>Loading quiz islands...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 md:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="mb-2 text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
              Quiz
            </h1>
            <p className="text-sm md:text-base text-gray-600">Practice what you've learned.</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg border border-gray-900 bg-gray-900 px-5 md:px-6 py-2.5 md:py-3 text-sm md:text-base font-medium text-white transition-colors hover:bg-gray-800"
          >
            + Create Quiz Island
          </button>
        </div>

        {/* Empty State */}
        {quizIslands.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <p className="mb-4 text-gray-600">
              No quiz islands yet. Create your first one to start practicing.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-lg border border-gray-900 bg-gray-900 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800"
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
                className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:border-gray-900 hover:bg-gray-50 hover:shadow-md"
              >
                <Link href={`/app/quiz/${island.id}`} className="block">
                  <h3 className="mb-2 text-xl font-bold text-gray-900">
                    {island.name}
                  </h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <p>
                      Chinese • {island.card_count} card
                      {island.card_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </Link>
                <div className="mt-4">
                  <Link
                    href={`/app/quiz/${island.id}`}
                    className="block w-full rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-gray-800"
                  >
                    Start Quiz
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-5 md:p-6 shadow-xl">
              <h3 className="mb-4 text-xl font-semibold text-gray-900">
                Create Quiz Island
              </h3>
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
                    className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm transition-colors focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
                    required
                    autoFocus
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Quiz islands are for Chinese practice only
                  </p>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewIslandName("");
                    }}
                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !newIslandName.trim()}
                    className="rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
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
