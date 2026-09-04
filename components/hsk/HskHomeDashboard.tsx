"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Calendar,
  ClipboardCheck,
  Flame,
  Layers,
  Library,
  Map as MapIcon,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import type { JourneyNode } from "@/components/app/PathNode";
import PathNode from "@/components/app/PathNode";
import { daysUntil, formatHskLevel } from "@/lib/utils/hsk";
import { HSK_APP_LABELS } from "@/lib/hsk-app-labels";
import {
  HSK_CARD_BORDER,
  HSK_CARD_SHADOW,
  HSK_CARD_SHADOW_HOVER,
} from "@/lib/glossy-theme";

interface Journey {
  id: string;
  topic: string;
}

function getIslandWordCount(node: JourneyNode) {
  if (typeof node.word_count === "number" && node.word_count > 0) {
    return node.word_count;
  }
  const order = node.order ?? node.position ?? 0;
  return order === 1 ? 5 : 10;
}

function FeatureCard({
  icon: Icon,
  title,
  description,
  cta,
  onClick,
}: {
  icon: typeof ClipboardCheck;
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[180px] flex-col rounded-2xl bg-white p-5 text-left transition-all hover:-translate-y-0.5 sm:min-h-[200px] sm:p-6"
      style={{ border: HSK_CARD_BORDER, boxShadow: HSK_CARD_SHADOW }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = HSK_CARD_SHADOW_HOVER;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = HSK_CARD_SHADOW;
      }}
    >
      <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--lingo-sky-pale)] text-[var(--lingo-blue)]">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <h3 className="lingo-display text-lg text-[var(--lingo-navy)]">{title}</h3>
      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[var(--lingo-text-muted)]">
        {description}
      </p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-[var(--lingo-blue)] transition-colors group-hover:text-[var(--lingo-navy)]">
        {cta} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </span>
    </button>
  );
}

function JourneyCard({
  journey,
  nodes,
  onOpen,
  onCreate,
}: {
  journey: Journey | null;
  nodes: JourneyNode[];
  onOpen: () => void;
  onCreate: () => void;
}) {
  const sortedNodes = useMemo(
    () => [...nodes].sort((a, b) => a.position - b.position),
    [nodes],
  );
  const islands = sortedNodes.filter((n) => n.node_type === "island");
  const wordsLearned = islands.reduce(
    (sum, n) => sum + (n.completed_at ? getIslandWordCount(n) : 0),
    0,
  );
  const totalWords = islands.reduce((sum, n) => sum + getIslandWordCount(n), 0);
  const currentNode =
    sortedNodes.find((n) => !n.completed_at && !!n.island_id) ??
    sortedNodes.find((n) => !n.completed_at);

  if (!journey) {
    return (
      <section
        className="mb-5 rounded-2xl bg-white p-6 sm:p-7"
        style={{
          border: "1px dashed var(--lingo-accent-border)",
          boxShadow: HSK_CARD_SHADOW,
        }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-teal)]">
          Active journey
        </p>
        <h2 className="lingo-display mt-2 text-2xl text-[var(--lingo-navy)]">
          Start your first journey
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--lingo-text-muted)]">
          Pick a topic and get a personalized 5-island path with stories woven
          in to lock in the words.
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
          style={{
            background: "var(--lingo-navy)",
            boxShadow: "0 8px 18px -10px rgba(7,30,46,.7)",
          }}
        >
          Create a journey <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </section>
    );
  }

  return (
    <section
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group mb-5 cursor-pointer rounded-2xl bg-white p-5 transition-all hover:-translate-y-0.5 sm:p-6"
      style={{ border: HSK_CARD_BORDER, boxShadow: HSK_CARD_SHADOW }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = HSK_CARD_SHADOW_HOVER;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = HSK_CARD_SHADOW;
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-teal)]">
            Active journey
          </p>
          <h2 className="lingo-display mt-1.5 text-2xl text-[var(--lingo-navy)] sm:text-[28px]">
            {journey.topic}
          </h2>
          <p className="mt-1.5 text-sm text-[var(--lingo-text-muted)]">
            5 islands · 2 stories · {totalWords} words
          </p>
        </div>
        <div className="text-right">
          <p className="lingo-display text-3xl leading-none text-[var(--lingo-navy)]">
            {wordsLearned}
          </p>
          <p className="mt-1 text-sm text-[var(--lingo-text-muted)]">
            of {totalWords} words
          </p>
        </div>
      </div>

      {sortedNodes.length > 0 && (
        <div className="mt-5 flex w-full items-center">
          {sortedNodes.map((node, i) => (
            <div key={node.id} className="flex min-w-0 flex-1 items-center">
              <div className="flex flex-1 justify-center">
                <PathNode
                  node={{ ...node, current: currentNode?.id === node.id }}
                  compact
                />
              </div>
              {i < sortedNodes.length - 1 && (
                <div
                  className="mx-1 h-px max-w-10 flex-1"
                  style={{
                    background: node.completed_at
                      ? "var(--lingo-teal)"
                      : "var(--lingo-accent-border)",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}

      <div
        className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-4"
        style={{ borderColor: "var(--lingo-accent-border)" }}
      >
        <p className="text-sm text-[var(--lingo-text-muted)]">
          {currentNode ? (
            <>
              Up next:{" "}
              <span className="font-semibold text-[var(--lingo-navy)]">
                {currentNode.name}
              </span>
            </>
          ) : (
            "Journey complete"
          )}
        </p>
        <span className="inline-flex items-center gap-1 text-sm font-bold text-[var(--lingo-blue)] transition-colors group-hover:text-[var(--lingo-navy)]">
          View journey <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
    </section>
  );
}

export default function HskHomeDashboard({
  basePath = "/app",
}: {
  /** Lets /hsk/app preview the HSK track without leaving that path prefix. */
  basePath?: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [hskCurrentLevel, setHskCurrentLevel] = useState<number | null>(null);
  const [hskTargetLevel, setHskTargetLevel] = useState<number | null>(null);
  const [testDate, setTestDate] = useState<string | null>(null);
  const [streakDays, setStreakDays] = useState(0);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [journeyNodes, setJourneyNodes] = useState<JourneyNode[]>([]);
  const [lastTestPercent, setLastTestPercent] = useState<number | null>(null);
  const [wordProgress, setWordProgress] = useState<{
    mastered: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    void (async () => {
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

      try {
        const jr = await fetch("/api/journey/active", { cache: "no-store" });
        if (jr.ok) {
          const d = await jr.json();
          setJourney(d.journey ?? null);
          setJourneyNodes(d.nodes ?? d.islands ?? []);
        }

        const tr = await fetch("/api/hsk/tests", { cache: "no-store" });
        if (tr.ok) {
          const d = await tr.json();
          const attempted = (d.tests ?? []).filter(
            (t: { lastPercent: number | null }) => t.lastPercent != null,
          );
          if (attempted.length > 0) {
            setLastTestPercent(attempted[attempted.length - 1].lastPercent);
          }
        }

        if (profile?.hsk_target_level) {
          const wr = await fetch(
            `/api/hsk/words?level=${profile.hsk_target_level}&page=0`,
            { cache: "no-store" },
          );
          if (wr.ok) {
            const d = await wr.json();
            setWordProgress({
              mastered: d.progress?.mastered ?? 0,
              total: d.progress?.total ?? 0,
            });
          }
        }

        const tzOffset = new Date().getTimezoneOffset();
        const now = new Date();
        const ar = await fetch(
          `/api/quiz-activity?year=${now.getFullYear()}&month=${now.getMonth() + 1}&tzOffset=${tzOffset}`,
          { cache: "no-store" },
        );
        if (ar.ok) {
          const d = await ar.json();
          const activityMap = new Map<string, number>();
          (d.activity || []).forEach((e: { date: string; count: number }) =>
            activityMap.set(e.date, e.count),
          );
          let streak = 0;
          for (let i = 0; i < 7; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const key = date.toISOString().split("T")[0];
            if ((activityMap.get(key) ?? 0) > 0) streak += 1;
            else break;
          }
          setStreakDays(streak);
        }
      } catch {
        // Ignore transient network/Fast Refresh failures
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-white">
        <span className="text-sm text-[var(--lingo-text-muted)]">Loading…</span>
      </div>
    );
  }

  const currentNode = journeyNodes.find((n) => !n.completed_at) ?? null;
  const daysToTest = testDate ? daysUntil(testDate) : null;
  const createPath =
    basePath === "/hsk/app" ? `${basePath}/journey` : `${basePath}/journey/create`;

  return (
    <div className="min-h-full bg-white px-4 py-6 sm:px-6 md:px-8 md:py-7">
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="lingo-display text-[30px] leading-tight text-[var(--lingo-navy)] sm:text-[34px]">
              Home
            </h1>
            <p className="mt-1.5 text-[15px] text-[var(--lingo-text-muted)]">
              Your personalized HSK path, practice, and review — in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-1">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--lingo-accent-border)] bg-[var(--lingo-sky-pale)] px-3 py-1.5 text-xs font-bold text-[var(--lingo-navy)]">
              <Star className="h-3.5 w-3.5 text-[var(--lingo-blue)]" aria-hidden />
              {hskCurrentLevel != null ? formatHskLevel(hskCurrentLevel) : "?"}
              {" → "}
              {hskTargetLevel != null ? formatHskLevel(hskTargetLevel) : "?"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--lingo-accent-border)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--lingo-navy)]">
              <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden />
              {streakDays} day streak
            </span>
            {daysToTest != null && daysToTest >= 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--lingo-accent-border)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--lingo-navy)]">
                <Calendar className="h-3.5 w-3.5 text-[var(--lingo-blue)]" aria-hidden />
                {daysToTest} days to test
              </span>
            )}
          </div>
        </header>

        <JourneyCard
          journey={journey}
          nodes={journeyNodes}
          onOpen={() => router.push(`${basePath}/journey`)}
          onCreate={() => router.push(createPath)}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FeatureCard
            icon={ClipboardCheck}
            title={HSK_APP_LABELS.tests.nav}
            description={
              lastTestPercent != null
                ? `Last score: ${lastTestPercent}%`
                : HSK_APP_LABELS.tests.description
            }
            cta="Take a test"
            onClick={() => router.push(`${basePath}/hsk-tests`)}
          />
          <FeatureCard
            icon={Library}
            title={HSK_APP_LABELS.vocabulary.nav}
            description={
              wordProgress && wordProgress.total > 0
                ? `${wordProgress.mastered} / ${wordProgress.total} mastered`
                : HSK_APP_LABELS.vocabulary.description
            }
            cta="Browse words"
            onClick={() => router.push(`${basePath}/hsk-words`)}
          />
          <FeatureCard
            icon={Layers}
            title={HSK_APP_LABELS.flashcards.nav}
            description={HSK_APP_LABELS.flashcards.description}
            cta="Start review"
            onClick={() => router.push(`${basePath}/hsk-flashcards`)}
          />
          <FeatureCard
            icon={MapIcon}
            title={HSK_APP_LABELS.journey.nav}
            description={
              currentNode ? currentNode.name : HSK_APP_LABELS.journey.description
            }
            cta="Continue"
            onClick={() => router.push(`${basePath}/journey`)}
          />
        </div>
      </div>
    </div>
  );
}
