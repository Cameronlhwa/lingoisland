"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import type {
  OnboardingStepKey,
  OnboardingNudge,
  UserOnboardingRow,
  EntrySource,
  OnboardingCompletionKey,
} from "@/types/onboarding";

const ONBOARDING_WINDOW_MINUTES = 120; // 2 hours for testing, adjust to 30 for production
const RATE_LIMIT_MINUTES = 2;

const NUDGE_COPY: Record<
  OnboardingStepKey,
  { title: string; body: string; cta: string; ctaHref: string }
> = {
  visit_home: {
    title: "Visit your home page",
    body: "See your progress island, daily story, and quiz decks all in one place.",
    cta: "Go to Home",
    ctaHref: "/app",
  },
  try_flashcards: {
    title: "Meet your study buddy",
    body: "Your capybara island upgrades every 10 cards you review! Create a quiz from your topic island words to start.",
    cta: "Create quiz",
    ctaHref: "/app/quiz",
  },
  try_quiz: {
    title: "Practice with quizzes",
    body: "Turn your islands into flashcard sessions. Quick and effective.",
    cta: "Open Quiz Islands",
    ctaHref: "/app/quiz",
  },
  try_story: {
    title: "Try today's story",
    body: "A short story built from your island words. Great for seeing vocab in context.",
    cta: "Read Daily Story",
    ctaHref: "/app/story/daily",
  },
  customize_settings: {
    title: "Make it yours",
    body: "Personalize your experience. Set your learning pace, preferences, and more.",
    cta: "Open Settings",
    ctaHref: "/app/settings",
  },
};

const STEP_PRIORITY: OnboardingStepKey[] = [
  "visit_home",
  "try_flashcards",
  "try_quiz",
  "try_story",
  "customize_settings",
];

function parseRow(row: Record<string, unknown>): UserOnboardingRow {
  const stepsCompleted = Array.isArray(row.steps_completed)
    ? row.steps_completed
    : [];
  const stepsDismissed = Array.isArray(row.steps_dismissed)
    ? row.steps_dismissed
    : [];
  return {
    user_id: row.user_id as string,
    onboarding_started_at: (row.onboarding_started_at as string) ?? null,
    onboarding_ends_at: (row.onboarding_ends_at as string) ?? null,
    onboarding_disabled: (row.onboarding_disabled as boolean) ?? false,
    steps_completed: stepsCompleted as string[],
    steps_dismissed: stepsDismissed as string[],
    last_nudge_shown_at: (row.last_nudge_shown_at as string) ?? null,
    entry_source: (row.entry_source as UserOnboardingRow["entry_source"]) ?? null,
    updated_at: (row.updated_at as string) ?? new Date().toISOString(),
  };
}

/** Nudges show on home or topic island page (for visit_home only). */
function isEligiblePath(step: OnboardingStepKey, pathname: string): boolean {
  if (step === "visit_home") {
    return pathname === "/app/topic-islands" || pathname.startsWith("/app/topic-islands/");
  }
  // All other nudges only on home
  return pathname === "/app";
}

export function useOnboardingNudges() {
  const pathname = usePathname();
  const [state, setState] = useState<{
    row: UserOnboardingRow | null;
    islandCount: number;
    loading: boolean;
  }>({ row: null, islandCount: 0, loading: true });
  const supabase = createClient();

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setState((s) => ({ ...s, row: null, islandCount: 0, loading: false }));
      return;
    }

    const [onboardingRes, countRes] = await Promise.all([
      supabase
        .from("user_onboarding")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("topic_islands")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

    const row = onboardingRes.data
      ? parseRow(onboardingRes.data as Record<string, unknown>)
      : null;
    const islandCount = countRes.count ?? 0;

    setState({
      row,
      islandCount,
      loading: false,
    });
  }, [supabase]);

  // Load once on mount
  useEffect(() => {
    load();
  }, [load]);

  const startOnboardingIfNeeded = useCallback(
    async (entrySource: EntrySource) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const created_at = (user as { created_at?: string }).created_at;
      // Use 2 hours from account creation only if account is still within that window;
      // otherwise use 2 hours from first app use (so existing users get one window)
      const createdMs = created_at ? new Date(created_at).getTime() : 0;
      const windowFromCreationEnd = createdMs + ONBOARDING_WINDOW_MINUTES * 60 * 1000;
      const useFirstAppUse =
        !created_at || now.getTime() >= windowFromCreationEnd;
      const startedAt = useFirstAppUse ? now : new Date(created_at);
      const endsAt = useFirstAppUse
        ? new Date(now.getTime() + ONBOARDING_WINDOW_MINUTES * 60 * 1000)
        : new Date(createdMs + ONBOARDING_WINDOW_MINUTES * 60 * 1000);

      const { data: existing } = await supabase
        .from("user_onboarding")
        .select("onboarding_ends_at, entry_source")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing?.onboarding_ends_at != null) {
        const existingEnd = new Date(existing.onboarding_ends_at).getTime();
        if (now.getTime() >= existingEnd) return;
        setState((s) => {
          if (!s.row) return s;
          return {
            ...s,
            row: {
              ...s.row,
              onboarding_started_at: s.row.onboarding_started_at ?? startedAt.toISOString(),
              onboarding_ends_at: s.row.onboarding_ends_at ?? endsAt.toISOString(),
              entry_source: s.row.entry_source ?? entrySource,
            },
          };
        });
        return;
      }

      const { data: upserted, error } = await supabase
        .from("user_onboarding")
        .upsert(
          {
            user_id: user.id,
            onboarding_started_at: startedAt.toISOString(),
            onboarding_ends_at: endsAt.toISOString(),
            entry_source: entrySource,
            updated_at: now.toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (!error && upserted) {
        setState((s) => ({
          ...s,
          row: parseRow(upserted as Record<string, unknown>) as UserOnboardingRow,
          islandCount: s.islandCount,
        }));
      }
      await load();
    },
    [supabase, load]
  );

  const dismissNudge = useCallback(
    async (key: OnboardingStepKey) => {
      const row = state.row;
      if (!row) return;
      const nextDismissed = [...row.steps_dismissed, key];
      const now = new Date().toISOString();
      setState((s) =>
        s.row
          ? {
              ...s,
              row: {
                ...s.row,
                steps_dismissed: nextDismissed,
                last_nudge_shown_at: now,
                updated_at: now,
              },
            }
          : s
      );
      await supabase
        .from("user_onboarding")
        .update({
          steps_dismissed: nextDismissed,
          last_nudge_shown_at: now,
          updated_at: now,
        })
        .eq("user_id", row.user_id);
    },
    [state.row, supabase]
  );

  const completeNudge = useCallback(
    async (key: OnboardingCompletionKey) => {
      const row = state.row;
      if (!row) return;
      if (row.steps_completed.includes(key)) return;
      const nextCompleted = [...row.steps_completed, key];
      const now = new Date().toISOString();
      setState((s) => {
        if (!s.row) return s;
        const next: typeof s = {
          ...s,
          row: {
            ...s.row,
            steps_completed: nextCompleted,
            // Don't set last_nudge_shown_at when completing (only when dismissing)
            // so the next nudge can show immediately without rate limit
            updated_at: now,
          },
        };
        return next;
      });
      await supabase
        .from("user_onboarding")
        .update({
          steps_completed: nextCompleted,
          updated_at: now,
        })
        .eq("user_id", row.user_id);
    },
    [state.row, state.islandCount, supabase]
  );
  const now = Date.now();
  const endsAt = state.row?.onboarding_ends_at
    ? new Date(state.row.onboarding_ends_at).getTime()
    : 0;
  const disabled =
    state.loading ||
    !state.row ||
    state.row.onboarding_disabled ||
    (endsAt > 0 && now >= endsAt);

  const lastShownAt = state.row?.last_nudge_shown_at
    ? new Date(state.row.last_nudge_shown_at).getTime()
    : 0;
  const rateLimited =
    lastShownAt > 0 && now - lastShownAt < RATE_LIMIT_MINUTES * 60 * 1000;

  let currentNudge: OnboardingNudge | null = null;

  if (!disabled && !state.loading && state.row && pathname) {
    const completed = new Set(state.row.steps_completed);
    const dismissed = new Set(state.row.steps_dismissed);
    const entrySource = state.row.entry_source ?? "unknown";
    const hasIsland = state.islandCount >= 1;

    for (const step of STEP_PRIORITY) {
      if (completed.has(step) || dismissed.has(step)) continue;
      if (!isEligiblePath(step, pathname)) continue;

      if (step === "visit_home") {
        // Only show for topic_island entry path
        if (entrySource !== "topic_island") continue;
      }
      // try_flashcards has no prereqs - show immediately on home
      if (step === "try_quiz") {
        if (!completed.has("try_flashcards") && !dismissed.has("try_flashcards")) continue;
      }
      if (step === "try_story") {
        if (!completed.has("try_quiz") && !dismissed.has("try_quiz")) continue;
      }
      // customize_settings has special behavior - handled separately below
      if (step === "customize_settings") continue;

      const copy = NUDGE_COPY[step];
      currentNudge = {
        key: step,
        title: copy.title,
        body: copy.body,
        cta: copy.cta,
        ctaHref: copy.ctaHref,
      };
      break;
    }

    if (rateLimited && currentNudge) {
      currentNudge = null;
    }
  }

  // Persistent settings nudge - always show if not completed/dismissed, regardless of rate limit
  let persistentSettingsNudge: OnboardingNudge | null = null;
  if (!disabled && !state.loading && state.row && pathname === "/app") {
    const completed = new Set(state.row.steps_completed);
    const dismissed = new Set(state.row.steps_dismissed);
    
    if (!completed.has("customize_settings") && !dismissed.has("customize_settings")) {
      const copy = NUDGE_COPY.customize_settings;
      persistentSettingsNudge = {
        key: "customize_settings",
        title: copy.title,
        body: copy.body,
        cta: copy.cta,
        ctaHref: copy.ctaHref,
      };
    }
  }

  return {
    currentNudge,
    persistentSettingsNudge,
    startOnboardingIfNeeded,
    dismissNudge,
    completeNudge,
    loading: state.loading,
  };
}
