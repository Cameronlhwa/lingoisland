"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Briefcase,
  Car,
  ChevronRight,
  HeartPulse,
  Layers,
  Plane,
  Plus,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import AppPageLoading from "@/components/app/AppPageLoading";

interface QuizIsland {
  id: string;
  name: string;
  created_at: string;
  card_count: number;
}

function deckIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (/\bhsk\b|flashcard|vocab/.test(n)) return BookOpen;
  if (/hospital|health|clinic|doctor/.test(n)) return HeartPulse;
  if (/driv|car|traffic/.test(n)) return Car;
  if (/food|restaurant|cook|eat/.test(n)) return Utensils;
  if (/travel|airport|trip|hotel/.test(n)) return Plane;
  if (/work|office|school|job/.test(n)) return Briefcase;
  return Layers;
}

export default function QuizIslandsPage() {
  const router = useRouter();
  const { convertText } = useCharacterSet();
  const { t } = useLanguage();
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

  async function loadQuizIslands() {
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
  }

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
      router.push(`/app/quiz/${data.quizIsland.id}`);
    } catch (error) {
      console.error("Error creating quiz island:", error);
      alert(
        error instanceof Error ? error.message : "Failed to create quiz island",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (islandId: string) => {
    if (
      !confirm(
        convertText(
          t(
            "Are you sure you want to delete this quiz island? This will also delete all cards in it.",
          ),
        ),
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
        error instanceof Error ? error.message : "Failed to delete quiz island",
      );
    } finally {
      setDeletingIslandId(null);
    }
  };

  if (loading) {
    return <AppPageLoading />;
  }

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-8 md:px-6">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-(--lingo-blue)">
            {convertText(t("Quiz"))}
          </p>
          <h1 className="lingo-display mt-1 max-w-xl text-3xl font-bold text-(--lingo-navy) sm:text-4xl">
            {convertText(t("Small quizzes."))}
            <br />
            {convertText(t("Big progress."))}
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-(--lingo-text-muted)">
            {convertText(t("Practice vocabulary from your islands and saved words."))}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-(--lingo-navy) px-5 py-3 text-sm font-bold text-white shadow-xs transition-colors hover:bg-(--lingo-navy-soft)"
        >
          <Plus size={16} aria-hidden />
          {convertText(t("Create Quiz Island"))}
        </button>
      </div>

      {quizIslands.length === 0 ? (
        <div
          className="mx-auto flex max-w-lg flex-col items-center rounded-[28px] border bg-white px-6 py-12 text-center"
          style={{
            borderColor: "var(--lingo-border)",
            boxShadow: "var(--lingo-shadow-card)",
          }}
        >
          <h2 className="lingo-display text-xl font-bold text-(--lingo-navy)">
            {convertText(t("Create your first quiz"))}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-(--lingo-text-muted)">
            {convertText(t("Create your first quiz island to start practicing."))}
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="mt-6 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-(--lingo-navy) px-5 py-3 text-sm font-bold text-white shadow-xs transition-colors hover:bg-(--lingo-navy-soft)"
          >
            <Plus size={16} aria-hidden />
            {convertText(t("Create Quiz Island"))}
          </button>
        </div>
      ) : (
        <section>
          <h2 className="lingo-display mb-4 text-xl font-bold text-(--lingo-navy)">
            {convertText(t("Your quiz decks"))}
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quizIslands.map((island) => {
              const Icon = deckIcon(island.name);
              return (
                <div
                  key={island.id}
                  className="group relative overflow-hidden rounded-[28px] border bg-white transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  style={{
                    borderColor: "var(--lingo-border)",
                    boxShadow: "var(--lingo-shadow-card)",
                  }}
                >
                  <Link href={`/app/quiz/${island.id}`} className="flex items-start gap-4 px-5 py-5">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                      style={{
                        background: "var(--lingo-sky-pale)",
                        color: "var(--lingo-navy)",
                      }}
                    >
                      <Icon size={18} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-2 pr-6 text-base font-bold leading-snug text-(--lingo-navy)">
                        {convertText(island.name)}
                      </h3>
                      <p className="mt-1 text-sm text-(--lingo-text-muted)">
                        {convertText(t("Chinese"))} · {island.card_count}{" "}
                        {convertText(t(island.card_count !== 1 ? "cards" : "card"))}
                      </p>
                    </div>
                    <ChevronRight
                      size={18}
                      className="mt-0.5 shrink-0 text-(--lingo-blue) transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                      aria-hidden
                    />
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(island.id);
                    }}
                    disabled={deletingIslandId === island.id}
                    className="absolute right-3 top-3 rounded-full px-2 py-1 text-xs font-semibold text-(--lingo-text-muted) opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100 disabled:opacity-50"
                    title={convertText(t("Delete island"))}
                  >
                    {deletingIslandId === island.id ? convertText(t("Deleting...")) : "×"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-[24px] border bg-white p-5 md:p-8"
            style={{
              borderColor: "var(--lingo-border)",
              boxShadow: "var(--lingo-shadow-card)",
            }}
          >
            <h2 className="lingo-display mb-6 text-2xl font-bold text-(--lingo-navy)">
              {convertText(t("Create Quiz Island"))}
            </h2>
            <form onSubmit={handleCreate}>
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-(--lingo-navy)">
                  {convertText(t("Name"))}
                </label>
                <input
                  type="text"
                  value={newIslandName}
                  onChange={(e) => setNewIslandName(e.target.value)}
                  placeholder={convertText(t("e.g., Basic Vocabulary"))}
                  className="w-full rounded-xl border bg-white px-4 py-2.5 text-(--lingo-text) focus:border-(--lingo-blue) focus:outline-hidden"
                  style={{ borderColor: "var(--lingo-border)" }}
                  required
                  autoFocus
                />
                <p className="mt-1 text-xs text-(--lingo-text-muted)">
                  {convertText(t("Quiz islands are for Chinese practice only"))}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewIslandName("");
                  }}
                  className="flex-1 rounded-2xl border bg-white px-4 py-2.5 text-sm font-semibold text-(--lingo-navy) transition-colors hover:bg-(--lingo-sky-pale)"
                  style={{ borderColor: "var(--lingo-border)" }}
                  disabled={creating}
                >
                  {convertText(t("Cancel"))}
                </button>
                <button
                  type="submit"
                  disabled={creating || !newIslandName.trim()}
                  className="flex-1 rounded-2xl bg-(--lingo-navy) px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-(--lingo-navy-soft) disabled:opacity-50"
                >
                  {creating ? convertText(t("Creating...")) : convertText(t("Create"))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
