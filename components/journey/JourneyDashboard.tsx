"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, Check, Lock, Map } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import { JourneyMap } from "@/components/journey/JourneyMap";
import { toJourneyUserError } from "@/components/journey/journeyUserError";

export type JourneyPathNode = {
  id: string;
  type: "island" | "story" | "tone_practice";
  position: number;
  islandOrder: number;
  name: string;
  nameZh?: string;
  hint?: string;
  wordCount: number;
  islandId?: string;
  storyId?: string;
  pronunciationSessionId?: string;
  completed: boolean;
  current: boolean;
  paywalled?: boolean;
};

function currentCtaLabel(node: JourneyPathNode, t: (key: string) => string) {
  if (node.type === "story") return t("Open now →");
  if (node.type === "tone_practice") {
    return node.completed ? t("Practice again →") : t("Practice now →");
  }
  return t("Continue →");
}

function currentTypeLabel(node: JourneyPathNode, t: (key: string) => string) {
  if (node.type === "story") return t("STORY CHECKPOINT");
  if (node.type === "tone_practice") return t("PRONUNCIATION CHECKPOINT");
  return t("ISLAND");
}

export function JourneyDashboard({
  title,
  why,
  completedAt,
  eyebrow,
  headerActions,
  backLink,
  extraHeader,
  pathNodes,
  onNodeActivate,
  clickError,
  hskLevelByIslandId,
}: {
  title: string;
  why?: string | null;
  completedAt?: string | null;
  eyebrow: string;
  headerActions?: ReactNode;
  backLink?: { label: string; onClick: () => void };
  extraHeader?: ReactNode;
  pathNodes: JourneyPathNode[];
  onNodeActivate: (node: JourneyPathNode) => void;
  clickError?: string | null;
  hskLevelByIslandId?: Record<string, number>;
}) {
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!clickError) return;
    setToast(toJourneyUserError(clickError, t("Couldn't open this checkpoint yet.")));
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [clickError, t]);

  const islands = pathNodes.filter((node) => node.type === "island");
  const stories = pathNodes.filter((node) => node.type === "story");
  const islandsDone = islands.filter((node) => node.completed).length;
  const remainingIslands = Math.max(0, islands.length - islandsDone);
  const plannedWords = islands.reduce((sum, node) => sum + node.wordCount, 0);
  const completedPlannedWords = islands
    .filter((node) => node.completed)
    .reduce((sum, node) => sum + node.wordCount, 0);
  const progressPct = islands.length > 0 ? (islandsDone / islands.length) * 100 : 0;
  const currentNode = pathNodes.find((node) => node.current) ?? null;
  const journeyComplete =
    !!completedAt || (pathNodes.length > 0 && pathNodes.every((node) => node.completed));
  const goal =
    typeof why === "string" && why.trim() && why.trim().length <= 90 ? why.trim() : null;

  return (
    <div className="mx-auto w-full max-w-[1220px] px-4 py-8 md:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          {backLink ? (
            <button
              type="button"
              onClick={backLink.onClick}
              className="mb-2 text-xs font-semibold text-(--lingo-text-muted) transition-colors hover:text-(--lingo-navy)"
            >
              ← {backLink.label}
            </button>
          ) : null}
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-(--lingo-blue)">
            {eyebrow}
          </p>
          <h1 className="lingo-display mt-1 max-w-xl text-[34px] font-bold leading-tight text-(--lingo-navy) sm:text-[40px]">
            {convertText(title)}
          </h1>
          <p className="mt-2 text-sm text-(--lingo-text-muted)">
            {completedPlannedWords} / {plannedWords} {t("planned words")}
          </p>
          {goal ? (
            <p className="mt-1 max-w-xl text-sm text-(--lingo-text-muted)">
              {t("Your goal:")} {convertText(goal)}
            </p>
          ) : null}
          {extraHeader}
        </div>
        {headerActions ? <div className="flex flex-wrap items-center gap-2">{headerActions}</div> : null}
      </div>

      <section
        className="relative mb-8 overflow-hidden rounded-[28px] border"
        style={{
          borderColor: "var(--lingo-border)",
          boxShadow: "var(--lingo-shadow-card)",
          background: "linear-gradient(120deg, #f5fbff 0%, #eaf8ff 48%, #ddf6fb 100%)",
        }}
      >
        <div className="grid items-stretch gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] lg:gap-6 lg:p-6">
          <div className="flex min-w-0 flex-col justify-between">
            <div>
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-(--lingo-blue)">
                  {t("Your progress")}
                </p>
                {journeyComplete ? (
                  <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-teal-700">
                    {t("Journey completed")}
                  </span>
                ) : null}
              </div>
              <div className="mb-2 h-3 overflow-hidden rounded-full" style={{ background: "rgba(191,231,245,0.7)" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${progressPct}%`, background: "var(--lingo-teal)" }}
                />
              </div>
              <p className="text-sm font-semibold text-(--lingo-navy)">
                {completedPlannedWords}/{plannedWords} {t("planned words")}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4">
              <HeroStat icon={<Map size={12} />} value={islands.length} label={t("Islands")} />
              <HeroStat icon={<BookOpen size={12} />} value={stories.length} label={t("Story checkpoints")} accent="orange" />
              <HeroStat icon={<Check size={12} />} value={plannedWords} label={t("planned words")} />
              <HeroStat icon={<Lock size={12} />} value={remainingIslands} label={t("Islands left")} />
            </div>
          </div>

          <div className="min-w-0">
            <CurrentCheckpointCard
              node={currentNode}
              completed={journeyComplete}
              onActivate={onNodeActivate}
            />
          </div>
        </div>
      </section>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="lingo-display text-xl font-bold text-(--lingo-navy)">
            {t("Your Learning Roadmap")}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-(--lingo-text-muted)">
            {t("Follow the path step by step. Complete each island to keep moving forward.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-(--lingo-text-muted)">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--lingo-teal)" }} />
            {t("Completed")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
            {t("Current")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lock size={11} />
            {t("Locked")}
          </span>
        </div>
      </div>

      <section
        className="relative overflow-hidden rounded-[28px] border"
        style={{
          borderColor: "var(--lingo-border)",
          boxShadow: "var(--lingo-shadow-card)",
        }}
        aria-label={t("Your Learning Roadmap")}
      >
        <JourneyMap
          nodes={pathNodes}
          onActivate={onNodeActivate}
          hskLevelByIslandId={hskLevelByIslandId}
        />
      </section>

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-(--lingo-navy) px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function HeroStat({
  value,
  label,
  icon,
  accent,
}: {
  value: number;
  label: string;
  icon: ReactNode;
  accent?: "orange";
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{
            background: accent === "orange" ? "rgba(251,191,36,0.18)" : "rgba(66,185,180,0.16)",
            color: accent === "orange" ? "#c2410c" : "var(--lingo-teal)",
          }}
        >
          {icon}
        </span>
        <p className="text-xl font-black leading-none text-(--lingo-navy)">{value}</p>
      </div>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-(--lingo-text-muted)">
        {label}
      </p>
    </div>
  );
}

function CurrentCheckpointCard({
  node,
  completed,
  onActivate,
}: {
  node: JourneyPathNode | null;
  completed: boolean;
  onActivate: (node: JourneyPathNode) => void;
}) {
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();

  if (!node) {
    return (
      <div
        className="rounded-[22px] bg-white p-5"
        style={{ border: "1px solid var(--lingo-border)", boxShadow: "var(--lingo-shadow-card)" }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-(--lingo-blue)">
          {t("Journey completed")}
        </p>
        <p className="mt-2 text-lg font-bold text-(--lingo-navy)">
          {completed ? t("Journey completed") : t("Up next")}
        </p>
      </div>
    );
  }

  const detail =
    node.type === "story" || node.type === "tone_practice"
      ? node.hint
      : [
          node.nameZh ? convertText(node.nameZh) : null,
          `${node.wordCount} ${t("planned words")}`,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div
      className="rounded-[22px] bg-white p-5"
      style={{ border: "1px solid var(--lingo-border)", boxShadow: "var(--lingo-shadow-card)" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-600">
        {currentTypeLabel(node, t)}
      </p>
      <h3 className="mt-2 text-lg font-bold leading-tight text-(--lingo-navy)">
        {convertText(node.name)}
      </h3>
      {detail ? (
        <p className="mt-2 text-sm leading-relaxed text-(--lingo-text-muted)">{detail}</p>
      ) : null}
      <button
        type="button"
        onClick={() => onActivate(node)}
        className="mt-4 inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-colors hover:brightness-105"
        style={{ background: "#ea580c", boxShadow: "0 8px 18px rgba(234,88,12,0.22)" }}
      >
        {currentCtaLabel(node, t)}
      </button>
    </div>
  );
}
