"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { QuizMasteryStats } from "@/components/app/QuizMasteryStats";
import ProgressModal from "@/components/app/ProgressModal";
import AppPageLoading from "@/components/app/AppPageLoading";

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
  const { convertText } = useCharacterSet();
  const { t } = useLanguage();

  const [quizIsland, setQuizIsland] = useState<QuizIsland | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);

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

  const handleStartEditName = () => {
    if (quizIsland) {
      setEditedName(quizIsland.name);
      setIsEditingName(true);
    }
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditedName("");
  };

  const handleSaveName = async () => {
    if (!editedName.trim() || !quizIsland || editedName === quizIsland.name) {
      handleCancelEditName();
      return;
    }

    setSavingName(true);
    try {
      const response = await fetch(`/api/quiz-islands/${quizIslandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editedName.trim() }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to update name");
      }

      setQuizIsland({ ...quizIsland, name: editedName.trim() });
      setIsEditingName(false);
      setEditedName("");
    } catch (error) {
      console.error("Error updating name:", error);
      alert(error instanceof Error ? error.message : "Failed to update name");
    } finally {
      setSavingName(false);
    }
  };

  if (loading) {
    return <AppPageLoading label={convertText(t("Loading quiz island..."))} />;
  }

  if (!quizIsland) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-600">{convertText(t("Quiz island not found"))}</div>
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
            ← {convertText(t("Back to Quiz"))}
          </button>
          {isEditingName ? (
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSaveName();
                  } else if (e.key === "Escape") {
                    handleCancelEditName();
                  }
                }}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-3xl font-bold text-gray-900 focus:border-gray-500 focus:outline-hidden focus:ring-2 focus:ring-gray-200"
                autoFocus
                disabled={savingName}
              />
              <button
                onClick={handleSaveName}
                disabled={savingName || !editedName.trim()}
                className="rounded-lg border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
              >
                {savingName ? convertText(t("Saving...")) : convertText(t("Save"))}
              </button>
              <button
                onClick={handleCancelEditName}
                disabled={savingName}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                {convertText(t("Cancel"))}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 group mb-2">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900">
                {convertText(quizIsland.name)}
              </h1>
              <button
                onClick={handleStartEditName}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 opacity-0 transition-all hover:border-gray-300 hover:text-gray-900 group-hover:opacity-100"
                title={convertText(t("Edit name"))}
              >
                {convertText(t("Edit"))}
              </button>
            </div>
          )}
          <p className="text-sm text-gray-600">
            {convertText(t("Chinese"))} • {quizIsland.card_count}{" "}
            {convertText(t(quizIsland.card_count !== 1 ? "cards" : "card"))}
          </p>
        </div>

        {/* Empty State */}
        {!hasCards ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-xs">
            <p className="mb-6 text-gray-600">
              {convertText(t("This quiz island is empty. Add cards to start practicing."))}
            </p>
            <Link
              href={`/app/quiz/${quizIslandId}/add`}
              className="inline-block rounded-lg border border-gray-900 bg-gray-900 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-gray-800"
            >
              {convertText(t("Add Cards"))}
            </Link>
          </div>
        ) : (
          /* Actions */
          <div className="space-y-6">
            <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-xs">
              <h2 className="mb-6 text-xl font-semibold text-gray-900">
                {convertText(t("Ready to practice?"))}
              </h2>
              <button
                onClick={() => router.push(`/app/quiz/${quizIslandId}/session`)}
                className="mb-2 w-full rounded-lg border border-gray-900 bg-gray-900 px-6 py-4 text-center text-base font-medium text-white transition-colors hover:bg-gray-800"
              >
                {convertText(t("Start Quiz"))}
              </button>
              <p className="mb-4 text-sm text-gray-500">
                {convertText(
                  t(
                    "Reviews here count toward your Progress Island on Home — every 10 cards levels up the island.",
                  ),
                )}
              </p>
              <div className="mt-4 flex gap-3">
                <Link
                  href={`/app/quiz/${quizIslandId}/add`}
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  {convertText(t("Add Cards"))}
                </Link>
                <Link
                  href={`/app/quiz/${quizIslandId}/manage`}
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  {convertText(t("Manage"))}
                </Link>
              </div>
            </div>

            <QuizMasteryStats 
              quizIslandId={quizIslandId}
              onTierClick={(tier) => {
                // Map bar keys to mastery tier names
                const tierMap: Record<string, string> = {
                  forgot: "relearning",
                  hard: "hard",
                  good: "good",
                  easy: "easy",
                };
                setSelectedTier(tierMap[tier] || tier);
                setShowProgressModal(true);
              }}
            />
          </div>
        )}

        {/* Progress Modal */}
        {showProgressModal && (
          <ProgressModal
            quizIslandId={quizIslandId}
            initialTier={selectedTier}
            onClose={() => setShowProgressModal(false)}
          />
        )}
      </div>
    </div>
  );
}

