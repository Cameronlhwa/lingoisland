"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import useSWR, { useSWRConfig } from "swr";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCharacterSet } from "@/contexts/CharacterSetContext";
import JourneyHero from "@/components/app/JourneyHero";
import { getLocalDateKey } from "@/lib/utils/date";
import UpgradeModal from "@/components/app/UpgradeModal";
import OnboardingNudgeBanner from "@/components/Onboarding/OnboardingNudgeBanner";
import { STAGE_THRESHOLDS, STAGE_NAMES, STAGE_EMOJIS } from "@/lib/huahua";
import { useProgressIslandSrc } from "@/lib/progressIslandImage";
import { hskLabelForCefr } from "@/lib/levelBands";
import {
  HSK_CARD_BORDER,
  HSK_CARD_SHADOW,
  HSK_CARD_SHADOW_HOVER,
} from "@/lib/glossy-theme";
import type { HomeCore, HomeStats, HomeStory } from "@/lib/home/loadHomeDashboard";
import { ArrowRight, Flame, Layers } from "lucide-react";

const STORAGE_KEY = "pending_topic_island_request";

async function fetchHomeCore(url: string, userId: string): Promise<HomeCore> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load home");
  }
  const data = (await response.json()) as HomeCore;
  if (data.userId !== userId) {
    throw new Error("Home data was for a different account");
  }
  return data;
}

async function fetchHomeStats(url: string, userId: string): Promise<HomeStats> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load home stats");
  }
  const data = (await response.json()) as HomeStats;
  if (data.userId !== userId) {
    throw new Error("Home stats were for a different account");
  }
  return data;
}

// ─── Capybara constants ────────────────────────────────────────────────────────


// ─── Sub-components ───────────────────────────────────────────────────────────

function Chip({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "solid";
}) {
  const className =
    tone === "solid"
      ? "bg-(--lingo-navy) text-white border-transparent"
      : tone === "accent"
        ? "bg-(--lingo-sky-pale) text-(--lingo-navy) border-(--lingo-accent-border)"
        : "bg-white text-(--lingo-navy) border-(--lingo-accent-border)";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${className}`}
    >
      {children}
    </span>
  );
}

function DashCardShell({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`group flex h-full min-h-[320px] flex-col overflow-hidden rounded-2xl bg-white transition-all hover:-translate-y-0.5 ${className}`}
      style={{ border: HSK_CARD_BORDER, boxShadow: HSK_CARD_SHADOW }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = HSK_CARD_SHADOW_HOVER;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = HSK_CARD_SHADOW;
      }}
    >
      {children}
    </div>
  );
}

function CardArt({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative h-[200px] overflow-hidden bg-(--lingo-sky-pale) sm:h-[220px]">
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover object-center"
        sizes="(max-width: 768px) 100vw, 380px"
      />
    </div>
  );
}

function CapybaraCard({
  stage,
  totalReviews,
  status,
  onRetry,
}: {
  stage: number | null;
  totalReviews: number | null;
  status: "ready" | "error" | "loading";
  onRetry: () => void;
}) {
  const ready = status === "ready" && stage != null && totalReviews != null;
  const safeStage = Math.min(5, Math.max(1, ready ? stage || 1 : 1));
  const prevThreshold = STAGE_THRESHOLDS[safeStage - 1] ?? 0;
  const nextThreshold = safeStage < 5 ? STAGE_THRESHOLDS[safeStage] : null;
  const stageRange = nextThreshold ? nextThreshold - prevThreshold : 10;
  const reviewCount = totalReviews ?? 0;
  const stageProgress = nextThreshold
    ? Math.min(100, ((reviewCount - prevThreshold) / stageRange) * 100)
    : 100;
  const reviewsUntilNext = nextThreshold
    ? Math.max(0, nextThreshold - reviewCount)
    : 0;
  const isComplete = safeStage === 5;
  const stageName = STAGE_NAMES[safeStage - 1];
  const stageEmoji = STAGE_EMOJIS[safeStage - 1];
  const islandSrc = useProgressIslandSrc(safeStage);

  return (
    <DashCardShell id="progress-island-card">
      <div className="flex h-[200px] items-center justify-center bg-(--lingo-sky-pale) px-2 sm:h-[220px]">
        {ready ? (
          <div className="island-bobble relative h-full w-full">
            <Image
              src={islandSrc}
              alt={`华华's island — Stage ${safeStage}`}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 320px"
            />
          </div>
        ) : (
          <div className="h-[70%] w-[70%] animate-pulse rounded-3xl bg-white/70" />
        )}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-(--lingo-sky-pale) text-(--lingo-blue)">
          <Layers className="h-5 w-5" aria-hidden />
        </span>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--lingo-teal)">
          华华&apos;s Island
        </p>
        {!ready ? (
          <div className="mt-3 flex flex-1 flex-col">
            <div className="h-6 w-40 animate-pulse rounded-sm bg-(--lingo-sky-pale)" />
            <div className="mt-3 h-1.5 w-full animate-pulse rounded-full bg-(--lingo-sky-pale)" />
            {status === "error" && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 text-left text-sm font-bold text-(--lingo-blue)"
              >
                Retry
              </button>
            )}
          </div>
        ) : (
          <>
        <h3 className="lingo-display mt-1.5 text-lg text-(--lingo-navy)">
          Stage {safeStage} · {stageName}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-(--lingo-text-muted)">
          {isComplete
            ? "Island complete — keep reviewing to stay sharp."
            : `Currently: ${stageEmoji} ${stageName}`}
        </p>
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-(--lingo-sky-pale)">
            <div
              className="h-full rounded-full bg-(--lingo-navy) transition-all duration-500"
              style={{ width: `${stageProgress}%` }}
            />
          </div>
          {!isComplete && (
            <p className="mt-2 text-xs text-(--lingo-text-muted)">
              {reviewsUntilNext} more card{reviewsUntilNext !== 1 ? "s" : ""} to
              Stage {safeStage + 1}
            </p>
          )}
        </div>
        <Link
          href="/app/quiz"
          className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-bold text-(--lingo-blue) transition-colors group-hover:text-(--lingo-navy)"
        >
          Review cards <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
          </>
        )}
      </div>
    </DashCardShell>
  );
}

function HomeDailyStoryCard({
  story,
  status,
  onRetry,
}: {
  story: HomeStory | null;
  status: "ready" | "empty" | "error" | "loading";
  onRetry: () => void;
}) {
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();

  if (status === "loading" || status === "error") {
    return (
      <DashCardShell>
        <CardArt src="/home/capybara-reading-island.png" alt="" />
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--lingo-teal)">
            {convertText(t("Daily Story"))}
          </p>
          <div className="mt-3 h-6 w-48 animate-pulse rounded-sm bg-(--lingo-sky-pale)" />
          <div className="mt-3 h-12 w-full animate-pulse rounded-sm bg-(--lingo-sky-pale)" />
          {status === "error" && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 text-left text-sm font-bold text-(--lingo-blue)"
            >
              Retry
            </button>
          )}
        </div>
      </DashCardShell>
    );
  }

  if (!story) {
    return (
      <Link href="/app/story/daily" className="block h-full">
        <DashCardShell>
          <CardArt
            src="/home/capybara-reading-island.png"
            alt="华华 reading on a floating island"
          />
          <div className="flex flex-1 flex-col p-5 sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--lingo-teal)">
              {convertText(t("Daily Story"))}
            </p>
            <h3 className="lingo-display mt-1.5 text-lg text-(--lingo-navy)">
              {convertText(t("Click me to read your daily story!"))}
            </h3>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-(--lingo-text-muted)">
              {convertText(
                t(
                  "Today's story weaves in words you've recently learned so you can recall them in a short reading."
                )
              )}
            </p>
            <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-bold text-(--lingo-blue) transition-colors group-hover:text-(--lingo-navy)">
              {convertText(t("Read story"))}{" "}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </span>
          </div>
        </DashCardShell>
      </Link>
    );
  }

  const level = (story as any).level as string | undefined;
  const lengthChars = (story as any).length_chars as number | undefined;
  const storyZh = (story as any).story_zh as string | undefined;
  const storyId = (story as any).id as string | undefined;
  const title = (story as any).title as string | undefined;
  const titleEn = (story as any).title_en as string | null | undefined;

  const readMins = lengthChars ? Math.max(1, Math.ceil(lengthChars / 200)) : 2;
  const excerpt = storyZh
    ? storyZh.slice(0, 80) + (storyZh.length > 80 ? "…" : "")
    : "";

  return (
    <DashCardShell>
      <CardArt
        src="/home/capybara-reading-island.png"
        alt={title ? `${title} illustration` : "Today's story illustration"}
      />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--lingo-teal)">
            {convertText(t("Daily Story · Today"))}
          </p>
          {level && (
            <span className="rounded-full border border-(--lingo-accent-border) bg-(--lingo-sky-pale) px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-(--lingo-navy)">
              {hskLabelForCefr(level)}
            </span>
          )}
          <span className="rounded-full border border-(--lingo-accent-border) bg-(--lingo-sky-pale) px-2 py-0.5 text-[10px] font-semibold text-(--lingo-text-muted)">
            ~{readMins} min
          </span>
        </div>
        <h3 className="lingo-display line-clamp-2 text-lg text-(--lingo-navy)">
          {title ?? "今日故事"}
        </h3>
        {titleEn && (
          <p className="mt-1 line-clamp-1 text-sm text-(--lingo-text-muted)">
            {titleEn}
          </p>
        )}
        {excerpt && (
          <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-(--lingo-text-muted)">
            {excerpt}
          </p>
        )}
        <Link
          href={storyId ? `/app/story/${storyId}` : "/app/story/daily"}
          className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-bold text-(--lingo-blue) transition-colors group-hover:text-(--lingo-navy)"
        >
          {convertText(t("Read story"))}{" "}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </DashCardShell>
  );
}

function CreateIslandDashCard() {
  return (
    <DashCardShell>
      <CardArt
        src="/home/capybara-explorer-new-island.png"
        alt="华华 exploring a new floating island"
      />
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--lingo-teal)">
          Topic Islands
        </p>
        <h3 className="lingo-display mt-1.5 text-lg text-(--lingo-navy)">
          Create a specialized island
        </h3>
        <p className="mt-1.5 flex-1 text-sm leading-relaxed text-(--lingo-text-muted)">
          Pick any topic and get vocab + examples tailored to your level.
        </p>
        <div className="mt-auto flex flex-col gap-2 pt-5">
          <Link
            href="/app/topic-islands?create=1"
            className="inline-flex items-center gap-1 text-sm font-bold text-(--lingo-blue) transition-colors hover:text-(--lingo-navy)"
          >
            Create island <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <Link
            href="/app/browse-topics"
            className="text-sm font-semibold text-(--lingo-text-muted) transition-colors hover:text-(--lingo-navy)"
          >
            Browse topics →
          </Link>
        </div>
      </div>
    </DashCardShell>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

function ChipSkeleton() {
  return (
    <span className="inline-flex h-[30px] w-28 animate-pulse rounded-full bg-(--lingo-sky-pale)" />
  );
}

function RetryChip({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-full border border-(--lingo-accent-border) bg-white px-3 py-1.5 text-xs font-bold text-(--lingo-blue)"
    >
      Retry
    </button>
  );
}

export default function HomeDashboard({
  initialCore,
}: {
  initialCore: HomeCore;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { mutate: globalMutate } = useSWRConfig();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeatureHint, setUpgradeFeatureHint] = useState<
    string | undefined
  >(undefined);
  const previousUserId = useRef(initialCore.userId);
  const localDate = getLocalDateKey();
  const tzOffset = new Date().getTimezoneOffset();
  const coreKey = initialCore.userId
    ? (["home-core", initialCore.userId, localDate] as const)
    : null;
  const statsKey = initialCore.userId
    ? (["home-stats", initialCore.userId, tzOffset] as const)
    : null;

  const {
    data: core,
    mutate: mutateCore,
  } = useSWR(
    coreKey,
    () => fetchHomeCore(`/api/home/dashboard?date=${localDate}`, initialCore.userId),
    {
      fallbackData: initialCore,
      revalidateOnMount: initialCore.dateKey !== localDate,
      revalidateIfStale: false,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    },
  );
  const {
    data: stats,
    error: statsError,
    mutate: mutateStats,
  } = useSWR(
    statsKey,
    () => fetchHomeStats(`/api/home/stats?tzOffset=${tzOffset}`, initialCore.userId),
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    },
  );

  const dashboard = core ?? initialCore;
  useEffect(() => {
    if (initialCore.dateKey !== localDate) return;
    void mutateCore(initialCore, { revalidate: false });
  }, [initialCore, localDate, mutateCore]);

  useEffect(() => {
    const pendingRequestStr = localStorage.getItem(STORAGE_KEY);
    if (pendingRequestStr) {
      router.replace("/app/topic-islands/loading");
    }
  }, [router]);

  useEffect(() => {
    const shouldOpenUpgrade = searchParams.get("upgrade") === "1";
    if (!shouldOpenUpgrade) return;
    const featureHint = searchParams.get("feature");
    setUpgradeFeatureHint(featureHint ?? undefined);
    setShowUpgradeModal(true);
    if (pathname !== "/app") return;
    router.replace("/app", { scroll: false });
  }, [searchParams, pathname, router]);

  useEffect(() => {
    const previous = previousUserId.current;
    if (previous && previous !== dashboard.userId) {
      void globalMutate(
        (key) =>
          Array.isArray(key) &&
          (key[0] === "home-core" || key[0] === "home-stats") &&
          key[1] === previous,
        undefined,
        { revalidate: false },
      );
    }
    previousUserId.current = dashboard.userId;
  }, [dashboard.userId, globalMutate]);

  useEffect(() => {
    const refresh = () => {
      void mutateCore();
      void mutateStats();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onHuahuaProgressUpdated = (event: Event) => {
      const detail = (
        event as CustomEvent<{ totalReviews?: number; stage?: number }>
      ).detail;
      if (
        typeof detail?.stage === "number" &&
        typeof detail.totalReviews === "number"
      ) {
        void mutateCore(
          (current) =>
            current
              ? {
                  ...current,
                  huahua: { stage: detail.stage!, reviews: detail.totalReviews! },
                  huahuaStatus: "ready",
                }
              : current,
          { revalidate: true },
        );
      } else {
        void mutateCore();
      }
      void mutateStats();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(
      "huahua-progress-updated",
      onHuahuaProgressUpdated as EventListener,
    );
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(
        "huahua-progress-updated",
        onHuahuaProgressUpdated as EventListener,
      );
    };
  }, [mutateCore, mutateStats]);

  const timeGreeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }, []);

  const huahuaReady = dashboard.huahuaStatus === "ready" && dashboard.huahua;
  const safeStage = huahuaReady
    ? Math.min(5, Math.max(1, dashboard.huahua?.stage || 1))
    : 1;
  const reviewCount = huahuaReady ? (dashboard.huahua?.reviews ?? 0) : 0;
  const nextThreshold = safeStage < 5 ? STAGE_THRESHOLDS[safeStage] : null;
  const reviewsUntilNext = nextThreshold
    ? Math.max(0, nextThreshold - reviewCount)
    : 0;
  const safeStageName = STAGE_NAMES[safeStage - 1];

  return (
    <div className="min-h-full bg-white px-4 py-6 sm:px-6 md:px-8 md:py-7">
      <OnboardingNudgeBanner variant="home" />

      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="lingo-display text-[30px] leading-tight text-(--lingo-navy) sm:text-[34px]">
              {timeGreeting}, {dashboard.firstName}
            </h1>
            {huahuaReady ? (
              <p className="mt-1.5 text-[15px] text-(--lingo-text-muted)">
                {reviewsUntilNext > 0
                  ? `${reviewsUntilNext} more card${reviewsUntilNext !== 1 ? "s" : ""} and 华华 hits Stage ${safeStage + 1}.`
                  : "华华's island is thriving — keep it up."}
              </p>
            ) : dashboard.huahuaStatus === "error" ? null : (
              <div className="mt-2 h-5 w-72 max-w-full animate-pulse rounded-sm bg-(--lingo-sky-pale)" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pb-1">
            {stats?.streakDays != null ? (
              <Chip tone="accent">
                <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden />
                {stats.streakDays} day streak
              </Chip>
            ) : statsError || stats?.status === "error" ? (
              <RetryChip onClick={() => void mutateStats()} />
            ) : (
              <ChipSkeleton />
            )}
            {dashboard.wordsStatus === "ready" && dashboard.wordsLearned != null ? (
              <Chip>{dashboard.wordsLearned} words learned</Chip>
            ) : dashboard.wordsStatus === "error" ? (
              <RetryChip onClick={() => void mutateCore()} />
            ) : (
              <ChipSkeleton />
            )}
            {stats?.dueCount != null && stats.dueCount > 0 && (
              <Chip>{stats.dueCount} due</Chip>
            )}
            {huahuaReady ? (
              <Chip tone="solid">
                华华 · Stage {safeStage} · {safeStageName}
              </Chip>
            ) : dashboard.huahuaStatus === "error" ? (
              <RetryChip onClick={() => void mutateCore()} />
            ) : (
              <ChipSkeleton />
            )}
          </div>
        </header>

        <JourneyHero
          journey={dashboard.journey}
          nodes={dashboard.journeyNodes}
          status={dashboard.journeyStatus}
          onRetry={() => void mutateCore()}
        />

        <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
          <CapybaraCard
            stage={dashboard.huahua?.stage ?? null}
            totalReviews={dashboard.huahua?.reviews ?? null}
            status={dashboard.huahuaStatus === "ready" ? "ready" : dashboard.huahuaStatus}
            onRetry={() => void mutateCore()}
          />
          <HomeDailyStoryCard
            story={dashboard.story}
            status={dashboard.storyStatus}
            onRetry={() => void mutateCore()}
          />
          <CreateIslandDashCard />
        </div>
      </div>

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        feature={upgradeFeatureHint}
      />
    </div>
  );
}
