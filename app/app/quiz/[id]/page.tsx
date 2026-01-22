"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { QuizMasteryStats } from "@/components/app/QuizMasteryStats";

interface QuizIsland {
  id: string;
  name: string;
  created_at: string;
  card_count: number;
}

export default function QuizIslandDetailPage() {
  const router = useRouter();
  const params = useParams();
  const quizIslandId = params.id as string;

  const [quizIsland, setQuizIsland] = useState<QuizIsland | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuizIsland();
  }, [quizIslandId]);

  const loadQuizIsland = async () => {
    try {
      const response = await fetch(`/api/quiz-islands/${quizIslandId}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push("/app/quiz");
          return;
        }
        throw new Error("Failed to load quiz island");
      }
      const data = await response.json();
      setQuizIsland(data.quizIsland);
    } catch (error) {
      console.error("Error loading quiz island:", error);
    } finally {
      setLoading(false);
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
          <span>Loading quiz island...</span>
        </div>
      </div>
    );
  }

  if (!quizIsland) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-600">Quiz island not found</div>
      </div>
    );
  }

  const hasCards = quizIsland.card_count > 0;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/app/quiz")}
            className="mb-4 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            ← Back to Quiz
          </button>
          <h1 className="mb-2 text-4xl font-bold tracking-tight text-gray-900">
            {quizIsland.name}
          </h1>
          <p className="text-sm text-gray-600">
            Chinese • {quizIsland.card_count} card
            {quizIsland.card_count !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Empty State */}
        {!hasCards ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
            <p className="mb-6 text-gray-600">
              This quiz island is empty. Add cards to start practicing.
            </p>
            <Link
              href={`/app/quiz/${quizIslandId}/add`}
              className="inline-block rounded-lg border border-gray-900 bg-gray-900 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800"
            >
              Add Cards
            </Link>
          </div>
        ) : (
          /* Actions */
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
              <h2 className="mb-6 text-xl font-semibold text-gray-900">
                Ready to practice?
              </h2>
              <button
                onClick={() => router.push(`/app/quiz/${quizIslandId}/session`)}
                className="mb-4 w-full rounded-lg border border-gray-900 bg-gray-900 px-6 py-4 text-center text-base font-medium text-white transition-colors hover:bg-gray-800"
              >
                Start Quiz
              </button>
              <div className="mt-4 flex gap-3">
                <Link
                  href={`/app/quiz/${quizIslandId}/add`}
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Add Cards
                </Link>
                <Link
                  href={`/app/quiz/${quizIslandId}/manage`}
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Manage
                </Link>
              </div>
            </div>

            <QuizMasteryStats quizIslandId={quizIslandId} />
          </div>
        )}
      </div>
    </div>
  );
}

