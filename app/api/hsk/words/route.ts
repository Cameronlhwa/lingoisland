import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { denyWithoutProductAccess } from "@/lib/product-access";
import { hskMaxStoredLevel } from "@/lib/utils/hsk";
import {
  HSK_STANDARD_COOKIE,
  resolveHskStandard,
} from "@/lib/hsk/standardPreference";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAGE_SIZE = 60;
const ID_PAGE = 1000;
const IN_CHUNK = 200;

type WordStatus = "not_introduced" | "learning" | "due" | "mastered";

type Progress = {
  total: number;
  mastered: number;
  due: number;
  learning: number;
};

function cardStatus(
  state: { due_at: string | null; mastery_tier: string | null } | undefined,
  now: number,
): WordStatus {
  if (!state) return "learning";
  if (state.due_at && new Date(state.due_at).getTime() <= now) return "due";
  if (state.mastery_tier === "easy") return "mastered";
  return "learning";
}

async function computeLevelProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  level: number,
  standard: string,
): Promise<Progress> {
  const { count } = await supabase
    .from("hsk_words")
    .select("id", { count: "exact", head: true })
    .eq("standard", standard)
    .eq("level", level)
    .eq("is_placeholder", false);

  const wordIds: string[] = [];
  for (let from = 0; ; from += ID_PAGE) {
    const { data } = await supabase
      .from("hsk_words")
      .select("id")
      .eq("standard", standard)
      .eq("level", level)
      .eq("is_placeholder", false)
      .range(from, from + ID_PAGE - 1);
    if (!data?.length) break;
    wordIds.push(...data.map((row) => row.id as string));
    if (data.length < ID_PAGE) break;
  }

  let mastered = 0;
  let due = 0;
  let learning = 0;
  const now = Date.now();

  for (let i = 0; i < wordIds.length; i += IN_CHUNK) {
    const chunk = wordIds.slice(i, i + IN_CHUNK);
    const { data: cards } = await supabase
      .from("cards")
      .select("id, source_ref_id")
      .eq("user_id", userId)
      .eq("source_type", "hsk_word")
      .in("source_ref_id", chunk);
    if (!cards?.length) continue;

    const cardIds = cards.map((card) => card.id);
    const { data: reviewStates } = await supabase
      .from("card_review_state")
      .select("card_id, due_at, mastery_tier")
      .eq("user_id", userId)
      .in("card_id", cardIds);
    const stateByCardId = new Map(
      (reviewStates ?? []).map((row) => [row.card_id, row]),
    );

    for (const card of cards) {
      const status = cardStatus(stateByCardId.get(card.id), now);
      if (status === "mastered") mastered += 1;
      else if (status === "due") due += 1;
      else learning += 1;
    }
  }

  return {
    total: count ?? wordIds.length,
    mastered,
    due,
    learning,
  };
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denial = await denyWithoutProductAccess(user.id, "hsk");
    if (denial) return denial;

    const url = new URL(request.url);
    const level = Number(url.searchParams.get("level") || "1");
    const page = Math.max(0, Number(url.searchParams.get("page") || "0"));
    // PostgREST's .or() filter DSL treats "," and "()" as syntax, so strip
    // them from user input before interpolating into the filter string.
    const search = (url.searchParams.get("search") || "")
      .replace(/[,()]/g, "")
      .trim()
      .slice(0, 100);

    const cookieStore = await cookies();
    let profileStandard: string | null = null;
    const profileResult = await supabase
      .from("user_profiles")
      .select("hsk_standard")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profileResult.error) {
      profileStandard = profileResult.data?.hsk_standard ?? null;
    }

    const standard = resolveHskStandard({
      query: url.searchParams.get("standard"),
      profile: profileStandard,
      cookie: cookieStore.get(HSK_STANDARD_COOKIE)?.value,
    });
    const maxLevel = hskMaxStoredLevel(standard);

    if (!Number.isInteger(level) || level < 1 || level > maxLevel) {
      return NextResponse.json(
        { error: `level must be 1-${maxLevel} for HSK ${standard}` },
        { status: 400 },
      );
    }

    let query = supabase
      .from("hsk_words")
      .select(
        "id, hanzi, pinyin, english, part_of_speech, example_sentence, example_pinyin",
        { count: "exact" },
      )
      .eq("standard", standard)
      .eq("level", level)
      .eq("is_placeholder", false)
      .order("sort_order", { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (search) {
      query = query.or(
        `hanzi.ilike.%${search}%,pinyin.ilike.%${search}%,english.ilike.%${search}%`,
      );
    }

    const { data: words, error, count } = await query;
    if (error) {
      console.error("[hsk/words] query", error);
      return NextResponse.json({ error: "Failed to load words" }, { status: 500 });
    }

    const wordIds = (words ?? []).map((w) => w.id);
    const statusByWordId = new Map<string, WordStatus>();

    if (wordIds.length > 0) {
      const { data: cards } = await supabase
        .from("cards")
        .select("id, source_ref_id")
        .eq("user_id", user.id)
        .eq("source_type", "hsk_word")
        .in("source_ref_id", wordIds);

      const cardIds = (cards ?? []).map((c) => c.id);
      let reviewStates: {
        card_id: string;
        due_at: string | null;
        mastery_tier: string | null;
      }[] = [];

      if (cardIds.length > 0) {
        const { data: crs } = await supabase
          .from("card_review_state")
          .select("card_id, due_at, mastery_tier")
          .eq("user_id", user.id)
          .in("card_id", cardIds);
        reviewStates = crs ?? [];
      }
      const stateByCardId = new Map(reviewStates.map((r) => [r.card_id, r]));
      const now = Date.now();

      for (const card of cards ?? []) {
        statusByWordId.set(
          card.source_ref_id as string,
          cardStatus(stateByCardId.get(card.id), now),
        );
      }
    }

    const wordsWithStatus = (words ?? []).map((w) => ({
      ...w,
      status: statusByWordId.get(w.id) ?? "not_introduced",
    }));

    let progress: Progress | null = null;
    const { data: progressRows, error: progressErr } = await supabase.rpc(
      "get_hsk_level_progress",
      { p_level: level, p_standard: standard },
    );
    if (!progressErr && progressRows?.[0]) {
      progress = progressRows[0] as Progress;
    } else {
      if (progressErr) {
        console.warn("[hsk/words] progress rpc", progressErr.message);
      }
      progress = await computeLevelProgress(supabase, user.id, level, standard);
    }

    return NextResponse.json({
      words: wordsWithStatus,
      total: count ?? 0,
      page,
      pageSize: PAGE_SIZE,
      progress,
      standard,
    });
  } catch (e) {
    console.error("[hsk/words]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
