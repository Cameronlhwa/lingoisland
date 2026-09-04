"use client";

/**
 * HSK Flashcards deck list — forked from `/app/quiz` so users can create
 * and manage multiple decks independently of Quiz Islands.
 */

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Info, TrendingUp, X } from "lucide-react";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import { createClient } from "@/lib/supabase/browser";
import { STAGE_THRESHOLDS, STAGE_NAMES, STAGE_EMOJIS, readHuahua } from "@/lib/huahua";
import { daysUntil } from "@/lib/utils/hsk";
import {
  hskFlashcardsDeck,
  useHskFlashcardsBasePath,
  useIsHskAppPreview,
} from "@/components/hsk/hskFlashcardsPaths";
import { HSK_APP_LABELS } from "@/lib/hsk-app-labels";

interface Deck {
  id: string;
  name: string;
  created_at: string;
  card_count: number;
}

interface Summary {
  totalCards: number;
  mastered: number;
  due: number;
  new: number;
}

const RING_R = 45;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

function ringDash(count: number, total: number) {
  if (total <= 0) return { length: 0, gap: RING_CIRCUMFERENCE };
  const length = (count / total) * RING_CIRCUMFERENCE;
  return { length, gap: RING_CIRCUMFERENCE - length };
}

export default function HskFlashcardsListPage() {
  const router = useRouter();
  const basePath = useHskFlashcardsBasePath();
  const isHskApp = useIsHskAppPreview();
  const { convertText } = useCharacterSet();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalCards: 0,
    mastered: 0,
    due: 0,
    new: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingDeckId, setDeletingDeckId] = useState<string | null>(null);

  // Goal bar
  const [hskCurrentLevel, setHskCurrentLevel] = useState<number | null>(null);
  const [hskTargetLevel, setHskTargetLevel] = useState<number | null>(null);
  const [testDate, setTestDate] = useState<string | null>(null);
  const [goalMastered, setGoalMastered] = useState(0);
  const [goalTotal, setGoalTotal] = useState(0);

  // 华华
  const [huahuaStage, setHuahuaStage] = useState(1);
  const [huahuaReviewsToday, setHuahuaReviewsToday] = useState(0);
  const [showHuahuaInfo, setShowHuahuaInfo] = useState(false);
  const huahuaInfoRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    loadDecks();
    loadGoalAndHuahua();
  }, []);

  useEffect(() => {
    if (!showHuahuaInfo) return;
    const onClick = (e: MouseEvent) => {
      if (huahuaInfoRef.current && !huahuaInfoRef.current.contains(e.target as Node)) {
        setShowHuahuaInfo(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [showHuahuaInfo]);

  async function loadDecks() {
    try {
      const response = await fetch("/api/hsk/flashcard-decks");
      if (!response.ok) throw new Error("Failed to load flashcard decks");
      const data = await response.json();
      setDecks(data.decks || []);
      if (data.summary) setSummary(data.summary);
    } catch (error) {
      console.error("Error loading flashcard decks:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadGoalAndHuahua() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("hsk_current_level, hsk_target_level, test_date")
      .eq("user_id", user.id)
      .maybeSingle();
    setHskCurrentLevel(profile?.hsk_current_level ?? null);
    setHskTargetLevel(profile?.hsk_target_level ?? null);
    setTestDate(profile?.test_date ?? null);

    if (profile?.hsk_target_level) {
      const wr = await fetch(`/api/hsk/words?level=${profile.hsk_target_level}&page=0`);
      if (wr.ok) {
        const wd = await wr.json();
        setGoalMastered(wd.progress?.mastered ?? 0);
        setGoalTotal(wd.progress?.total ?? 0);
      }
    }

    const { huahuaReviewsToday: reviewsToday, huahuaStage: stage } = await readHuahua(
      supabase,
      user.id,
    );
    setHuahuaReviewsToday(reviewsToday);
    setHuahuaStage(stage);
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim()) return;

    setCreating(true);
    try {
      const response = await fetch("/api/hsk/flashcard-decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDeckName.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create deck");
      }

      const data = await response.json();
      setShowCreateModal(false);
      setNewDeckName("");
      router.push(hskFlashcardsDeck(basePath, data.deck.id));
    } catch (error) {
      console.error("Error creating deck:", error);
      alert(error instanceof Error ? error.message : "Failed to create deck");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (deckId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this deck? This will also delete all cards in it.",
      )
    ) {
      return;
    }

    setDeletingDeckId(deckId);
    try {
      const response = await fetch(`/api/hsk/flashcard-decks?deckId=${deckId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete deck");
      }

      setDecks(decks.filter((deck) => deck.id !== deckId));
    } catch (error) {
      console.error("Error deleting deck:", error);
      alert(error instanceof Error ? error.message : "Failed to delete deck");
    } finally {
      setDeletingDeckId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  const safeStage = Math.min(5, Math.max(1, huahuaStage || 1));
  const stageName = STAGE_NAMES[safeStage - 1];
  const prevThreshold = STAGE_THRESHOLDS[safeStage - 1] ?? 0;
  const nextThreshold = safeStage < 5 ? STAGE_THRESHOLDS[safeStage] : null;
  const stageRange = nextThreshold ? nextThreshold - prevThreshold : 10;
  const huahuaStageProgress = nextThreshold
    ? Math.min(100, ((huahuaReviewsToday - prevThreshold) / stageRange) * 100)
    : 100;
  const reviewsUntilNextStage = nextThreshold
    ? Math.max(0, nextThreshold - huahuaReviewsToday)
    : 0;

  const goalPct = goalTotal > 0 ? Math.round((goalMastered / goalTotal) * 100) : 0;
  const daysToTest = testDate ? daysUntil(testDate) : null;

  const masteredDash = ringDash(summary.mastered, summary.totalCards);
  const dueDash = ringDash(summary.due, summary.totalCards);
  const newDash = ringDash(summary.new, summary.totalCards);
  const dueOffset = masteredDash.length;
  const newOffset = masteredDash.length + dueDash.length;

  return (
    <div className="mx-auto min-h-screen max-w-6xl p-4 md:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className={`text-2xl md:text-3xl ${isHskApp ? "lingo-display text-[var(--lingo-navy)]" : "font-bold text-gray-900"}`}>
          {isHskApp ? HSK_APP_LABELS.flashcards.title : "Flashcards"}
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 rounded-lg bg-[#1a2332] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#2d3a4d] md:px-6 md:py-3"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Create Deck
        </button>
      </div>

      {hskTargetLevel != null && (
        <div className="mb-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#1a2332]" aria-hidden />
              <span className="text-sm font-extrabold text-[#1a2332]">
                HSK {hskCurrentLevel ?? "?"} &rarr; HSK {hskTargetLevel}
              </span>
            </div>
            <span className="text-xs font-semibold text-teal-700">
              {goalPct}% mastered
              {daysToTest != null && daysToTest >= 0 ? ` · ${daysToTest} days to test` : ""}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[#dbe7ee]">
            <div
              className="h-full rounded-full bg-teal-500 transition-all"
              style={{ width: `${goalPct}%` }}
            />
          </div>
        </div>
      )}

      <div className="mb-9 grid grid-cols-1 rounded-2xl border border-[#dbe7ee] sm:grid-cols-2">
        {/* Left: mastered / due / new ring across every HSK deck */}
        <div className="flex items-center gap-5 border-b border-[#dbe7ee] bg-[#F4F8FB] p-6 sm:rounded-l-2xl sm:border-b-0 sm:border-r max-sm:rounded-t-2xl">
          <div className="relative h-[104px] w-[104px] shrink-0">
            <svg width="104" height="104" viewBox="0 0 108 108">
              <circle cx="54" cy="54" r={RING_R} fill="none" stroke="#dbe7ee" strokeWidth="14" />
              <circle
                cx="54"
                cy="54"
                r={RING_R}
                fill="none"
                stroke="#14b8a6"
                strokeWidth="14"
                strokeDasharray={`${masteredDash.length} ${masteredDash.gap}`}
                strokeDashoffset="0"
                transform="rotate(-90 54 54)"
              />
              <circle
                cx="54"
                cy="54"
                r={RING_R}
                fill="none"
                stroke="#f97316"
                strokeWidth="14"
                strokeDasharray={`${dueDash.length} ${dueDash.gap}`}
                strokeDashoffset={-dueOffset}
                transform="rotate(-90 54 54)"
              />
              <circle
                cx="54"
                cy="54"
                r={RING_R}
                fill="none"
                stroke="#a9bdc9"
                strokeWidth="14"
                strokeDasharray={`${newDash.length} ${newDash.gap}`}
                strokeDashoffset={-newOffset}
                transform="rotate(-90 54 54)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-xl font-extrabold leading-none text-[#1a2332]">
                {summary.totalCards}
              </div>
              <div className="text-[10px] font-semibold text-[#7c93a3]">cards</div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
              <span className="text-sm font-semibold text-[#1a2332]">
                {summary.mastered} mastered
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
              <span className="text-sm font-semibold text-[#1a2332]">{summary.due} due today</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#a9bdc9]" />
              <span className="text-sm font-semibold text-[#1a2332]">{summary.new} new</span>
            </div>
          </div>
        </div>

        {/* Right: 华华's daily progress */}
        <div className="relative flex items-center gap-4 overflow-visible bg-[#F4F8FB] p-6 sm:rounded-r-2xl max-sm:rounded-b-2xl">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="text-sm font-extrabold text-[#1a2332]">
                华华 &middot; {stageName}
              </span>
              <div className="relative" ref={huahuaInfoRef}>
                <button
                  type="button"
                  onClick={() => setShowHuahuaInfo((v) => !v)}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-[#7c93a3] transition-colors hover:text-[#1a2332]"
                  aria-label="What is 华华?"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden />
                </button>
                {showHuahuaInfo && (
                  <div className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-xl border border-[#dbe7ee] bg-white p-3 text-xs leading-relaxed text-[#475569] shadow-lg">
                    <button
                      type="button"
                      onClick={() => setShowHuahuaInfo(false)}
                      className="absolute right-2 top-2 text-[#a9bdc9] hover:text-[#7c93a3]"
                      aria-label="Close"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    华华's island grows with every card you review <strong>today</strong> —
                    10 reviews per stage, 5 stages total. It resets each day, so showing up
                    daily is what keeps it growing.
                  </div>
                )}
              </div>
            </div>
            <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-[#dbe7ee]">
              <div
                className="h-full rounded-full bg-teal-500 transition-all"
                style={{ width: `${huahuaStageProgress}%` }}
              />
            </div>
            <div className="text-xs font-semibold text-teal-700">
              {huahuaReviewsToday}
              {nextThreshold != null ? ` / ${nextThreshold}` : ""} reviews today
              {safeStage < 5 ? ` · ${reviewsUntilNextStage} more to ${STAGE_NAMES[safeStage]}` : ""}
            </div>
          </div>
        </div>
      </div>

      {decks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="mb-8 text-lg text-gray-600">
            Create your first flashcard deck to start practicing
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="rounded-lg bg-[#1a2332] px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-[#2d3a4d]"
          >
            Create Deck
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <div
              key={deck.id}
              className="group relative rounded-2xl border border-[#dbe7ee] bg-white p-5 transition-all hover:border-[#7c93a3] hover:shadow-sm"
            >
              <Link href={hskFlashcardsDeck(basePath, deck.id)} className="block">
                <h3 className="mb-2 text-base font-bold text-[#1a2332]">
                  {convertText(deck.name)}
                </h3>
                <p className="text-sm text-[#7c93a3]">
                  {deck.card_count} card{deck.card_count !== 1 ? "s" : ""}
                </p>
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDelete(deck.id);
                }}
                disabled={deletingDeckId === deck.id}
                className="absolute right-4 top-4 text-sm text-gray-400 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100 disabled:opacity-50"
                title="Delete deck"
              >
                {deletingDeckId === deck.id ? "Deleting..." : "×"}
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#dbe7ee] bg-white p-5 shadow-xl md:p-8">
            <h2 className="mb-6 text-2xl font-bold text-[#1a2332]">Create Deck</h2>
            <form onSubmit={handleCreate}>
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-[#1a2332]">Name</label>
                <input
                  type="text"
                  value={newDeckName}
                  onChange={(e) => setNewDeckName(e.target.value)}
                  placeholder="e.g., HSK 3 Vocabulary"
                  className="w-full rounded-lg border border-[#dbe7ee] bg-white px-4 py-2 focus:border-[#1a2332] focus:outline-none"
                  required
                  autoFocus
                />
                <p className="mt-1 text-xs text-[#7c93a3]">Decks are for Chinese practice only</p>
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewDeckName("");
                  }}
                  className="flex-1 rounded-lg border border-[#dbe7ee] bg-white px-4 py-2 text-base text-[#1a2332] transition-colors hover:bg-gray-50"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newDeckName.trim()}
                  className="flex-1 rounded-lg bg-[#1a2332] px-4 py-2 text-base font-medium text-white transition-colors hover:bg-[#2d3a4d] disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
