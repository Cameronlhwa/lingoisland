import type { SupabaseClient } from "@supabase/supabase-js";
import { mapJourneyIslandRow } from "@/lib/journey/mapJourneyNodes";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { resolveStoryDateKey } from "@/lib/profile/timeZone";
import { getLocalDateKey } from "@/lib/utils/date";

export type HomeStory = {
  id: string;
  title: string;
  title_en: string | null;
  level: string;
  date: string | null;
  created_at: string;
  story_zh: string;
  length_chars: number | null;
};

export type HomeJourneyNode = {
  id: string;
  order: number;
  position: number;
  node_type: "island" | "story" | "tone_practice";
  name: string;
  hint: string | null;
  word_count: number | null;
  completed_at: string | null;
  island_id: string | null;
  story_id: string | null;
};

export type HomeCore = {
  userId: string;
  firstName: string;
  wordsLearned: number | null;
  wordsStatus: "ready" | "error";
  huahua: { stage: number; reviews: number } | null;
  huahuaStatus: "ready" | "error";
  dateKey: string;
  timeZone: string | null;
  story: HomeStory | null;
  storyStatus: "ready" | "empty" | "error";
  journey: { id: string; topic: string } | null;
  journeyNodes: HomeJourneyNode[];
  journeyStatus: "ready" | "empty" | "error";
};

export type HomeStats = {
  userId: string;
  streakDays: number | null;
  dueCount: number | null;
  status: "ready" | "error";
};

function firstNameFromUser(user: {
  user_metadata?: Record<string, unknown>;
  email?: string | null;
}) {
  const fullName = user.user_metadata?.full_name;
  const name = user.user_metadata?.name;
  return (
    (typeof fullName === "string" ? fullName.split(" ")[0] : "") ||
    (typeof name === "string" ? name.split(" ")[0] : "") ||
    user.email?.split("@")[0] ||
    "there"
  );
}

function huahuaFromProfile(profile: {
  huahua_stage?: number | null;
  huahua_reviews_today?: number | null;
  huahua_last_review_date?: string | null;
  huahua_total_reviews?: number | null;
} | null): { stage: number; reviews: number } {
  if (!profile) return { stage: 1, reviews: 0 };
  const today = new Date().toISOString().split("T")[0];
  if (profile.huahua_reviews_today != null) {
    const isToday = profile.huahua_last_review_date === today;
    return {
      reviews: isToday ? (profile.huahua_reviews_today ?? 0) : 0,
      stage: isToday ? (profile.huahua_stage ?? 1) : 1,
    };
  }
  return {
    reviews: profile.huahua_total_reviews ?? 0,
    stage: profile.huahua_stage ?? 1,
  };
}

function localDateKey(utcMs: number, tzOffsetMinutes: number) {
  const localMs = utcMs - tzOffsetMinutes * 60 * 1000;
  return new Date(localMs).toISOString().split("T")[0];
}

function last7DateKeys(now: Date, tzOffsetMinutes: number) {
  const keys: string[] = [];
  for (let daysBack = 6; daysBack >= 0; daysBack -= 1) {
    const localMs = now.getTime() - tzOffsetMinutes * 60 * 1000;
    const local = new Date(localMs);
    const keyMs = Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() - daysBack,
    );
    keys.push(new Date(keyMs).toISOString().split("T")[0]);
  }
  return keys;
}

function streakFromCounts(
  counts: Map<string, number>,
  now: Date,
  tzOffsetMinutes: number,
) {
  const keys = last7DateKeys(now, tzOffsetMinutes);
  let streak = 0;
  for (let i = keys.length - 1; i >= 0; i -= 1) {
    if ((counts.get(keys[i]) ?? 0) > 0) streak += 1;
    else break;
  }
  return streak;
}

function activityWindow(now: Date, tzOffsetMinutes: number) {
  const keys = last7DateKeys(now, tzOffsetMinutes);
  const [startKey] = keys;
  const endKey = keys[keys.length - 1];
  const [startYear, startMonth, startDay] = startKey.split("-").map(Number);
  const [endYear, endMonth, endDay] = endKey.split("-").map(Number);
  const start = new Date(
    Date.UTC(startYear, startMonth - 1, startDay) + tzOffsetMinutes * 60 * 1000,
  );
  const end = new Date(
    Date.UTC(endYear, endMonth - 1, endDay + 1) + tzOffsetMinutes * 60 * 1000,
  );
  return { start, end };
}

async function loadHuahua(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ stage: number; reviews: number }> {
  const full = await supabase
    .from("user_profiles")
    .select(
      "huahua_stage, huahua_reviews_today, huahua_last_review_date, huahua_total_reviews",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (!full.error) {
    return huahuaFromProfile(full.data);
  }

  const fallback = await supabase
    .from("user_profiles")
    .select("huahua_stage, huahua_total_reviews")
    .eq("user_id", userId)
    .maybeSingle();
  if (fallback.error) {
    throw fallback.error;
  }
  return huahuaFromProfile(fallback.data);
}

async function loadWordsLearned(supabase: SupabaseClient, userId: string) {
  const { count, error } = await supabase
    .from("island_words")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .not("learned_at", "is", null);
  if (error) throw error;
  return count ?? 0;
}

async function loadTodayStory(
  supabase: SupabaseClient,
  userId: string,
  today: string,
): Promise<HomeStory | null> {
  const { data, error } = await supabase
    .from("stories")
    .select(
      "id, title, title_en, level, date, created_at, story_zh, length_chars",
    )
    .eq("user_id", userId)
    .eq("kind", "daily")
    .eq("date", today)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as HomeStory | null) ?? null;
}

async function loadJourney(supabase: SupabaseClient, userId: string) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("active_journey_id")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  const journeyId = profile?.active_journey_id;
  if (!journeyId) {
    return { journey: null, nodes: [] as HomeJourneyNode[] };
  }

  const [journeyResult, nodesResult] = await Promise.all([
    supabase
      .from("journeys")
      .select("id, topic")
      .eq("id", journeyId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("journey_islands")
      .select(
        "id, step_order, node_type, position, name, hint, word_count, island_id, story_id, completed_at",
      )
      .eq("journey_id", journeyId)
      .order("step_order", { ascending: true }),
  ]);

  if (journeyResult.error) throw journeyResult.error;
  if (nodesResult.error) throw nodesResult.error;
  if (!journeyResult.data) {
    return { journey: null, nodes: [] as HomeJourneyNode[] };
  }

  const nodes = (nodesResult.data ?? []).map((row) => {
    const mapped = mapJourneyIslandRow(row);
    return {
      id: mapped.id,
      order: mapped.order,
      position: mapped.position,
      node_type: mapped.node_type,
      name: mapped.name,
      hint: mapped.hint ?? null,
      word_count: mapped.word_count ?? null,
      completed_at: mapped.completed_at ?? null,
      island_id: mapped.island_id ?? null,
      story_id: mapped.story_id ?? null,
    } satisfies HomeJourneyNode;
  });

  return {
    journey: { id: journeyResult.data.id, topic: journeyResult.data.topic },
    nodes,
  };
}

function emptyCore(
  userId: string,
  firstName: string,
  dateKey: string,
  timeZone: string | null = null,
): HomeCore {
  return {
    userId,
    firstName,
    dateKey,
    timeZone,
    wordsLearned: null,
    wordsStatus: "error",
    huahua: null,
    huahuaStatus: "error",
    story: null,
    storyStatus: "error",
    journey: null,
    journeyNodes: [],
    journeyStatus: "error",
  };
}

export async function loadHomeCore(date?: string): Promise<HomeCore> {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    const dateKey =
      date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : getLocalDateKey();
    return emptyCore("", "there", dateKey);
  }

  const supabase = await createClient();
  const resolved = await resolveStoryDateKey(supabase, user.id);
  const dateKey =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : resolved.dateKey;
  const firstName = firstNameFromUser(user);
  const [huahua, words, story, journey] = await Promise.allSettled([
    loadHuahua(supabase, user.id),
    loadWordsLearned(supabase, user.id),
    loadTodayStory(supabase, user.id, dateKey),
    loadJourney(supabase, user.id),
  ]);

  return {
    userId: user.id,
    firstName,
    dateKey,
    timeZone: resolved.timeZone,
    wordsLearned: words.status === "fulfilled" ? words.value : null,
    wordsStatus: words.status === "fulfilled" ? "ready" : "error",
    huahua: huahua.status === "fulfilled" ? huahua.value : null,
    huahuaStatus: huahua.status === "fulfilled" ? "ready" : "error",
    story: story.status === "fulfilled" ? story.value : null,
    storyStatus:
      story.status === "fulfilled"
        ? story.value
          ? "ready"
          : "empty"
        : "error",
    journey: journey.status === "fulfilled" ? journey.value.journey : null,
    journeyNodes: journey.status === "fulfilled" ? journey.value.nodes : [],
    journeyStatus:
      journey.status === "fulfilled"
        ? journey.value.journey
          ? "ready"
          : "empty"
        : "error",
  };
}

async function countDueCards(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("card_collections")
    .select("card_id")
    .eq("user_id", userId)
    .eq("collection_type", "deck");
  if (error) throw error;
  const ids = (data ?? [])
    .map((row) => row.card_id as string | null)
    .filter((id): id is string => Boolean(id));
  if (ids.length === 0) return 0;

  const now = new Date().toISOString();
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) {
    chunks.push(ids.slice(i, i + 100));
  }
  const counts = await Promise.all(
    chunks.map(async (slice) => {
      const { count, error: countError } = await supabase
        .from("card_review_state")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .lte("due_at", now)
        .in("card_id", slice);
      if (countError) throw countError;
      return count ?? 0;
    }),
  );
  return counts.reduce((sum, count) => sum + count, 0);
}

async function loadStreakDays(
  supabase: SupabaseClient,
  userId: string,
  tzOffsetMinutes: number,
) {
  const now = new Date();
  const { start, end } = activityWindow(now, tzOffsetMinutes);
  const counts = new Map<string, number>();
  const addRows = (rows: { reviewed_at?: string | null; last_reviewed_at?: string | null }[] | null, field: "reviewed_at" | "last_reviewed_at") => {
    for (const row of rows ?? []) {
      const stamp = row[field];
      if (!stamp) continue;
      const key = localDateKey(new Date(stamp).getTime(), tzOffsetMinutes);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  };

  const [quizEvents, topicEvents] = await Promise.all([
    supabase
      .from("quiz_activity_events")
      .select("reviewed_at")
      .eq("user_id", userId)
      .gte("reviewed_at", start.toISOString())
      .lt("reviewed_at", end.toISOString()),
    supabase
      .from("topic_island_review_events")
      .select("reviewed_at")
      .eq("user_id", userId)
      .gte("reviewed_at", start.toISOString())
      .lt("reviewed_at", end.toISOString()),
  ]);

  if (quizEvents.error) {
    console.error("Error fetching quiz activity:", quizEvents.error);
  } else {
    addRows(quizEvents.data, "reviewed_at");
  }
  if (topicEvents.error) {
    console.error("Error fetching topic island review activity:", topicEvents.error);
  } else {
    addRows(topicEvents.data, "reviewed_at");
  }

  if (counts.size === 0) {
    const fallback = await supabase
      .from("card_review_state")
      .select("last_reviewed_at")
      .eq("user_id", userId)
      .gte("last_reviewed_at", start.toISOString())
      .lt("last_reviewed_at", end.toISOString());
    if (fallback.error) throw fallback.error;
    addRows(fallback.data, "last_reviewed_at");
  }

  return streakFromCounts(counts, now, tzOffsetMinutes);
}

export async function loadHomeStats(tzOffsetMinutes: number): Promise<HomeStats> {
  const { user } = await getAuthenticatedUser();
  if (!user) {
    return { userId: "", streakDays: null, dueCount: null, status: "error" };
  }
  if (!Number.isFinite(tzOffsetMinutes) || Math.abs(tzOffsetMinutes) > 14 * 60) {
    return { userId: user.id, streakDays: null, dueCount: null, status: "error" };
  }

  const supabase = await createClient();
  const [streak, due] = await Promise.allSettled([
    loadStreakDays(supabase, user.id, tzOffsetMinutes),
    countDueCards(supabase, user.id),
  ]);

  const ready = streak.status === "fulfilled" && due.status === "fulfilled";
  return {
    userId: user.id,
    streakDays: streak.status === "fulfilled" ? streak.value : null,
    dueCount: due.status === "fulfilled" ? due.value : null,
    status: ready ? "ready" : "error",
  };
}
