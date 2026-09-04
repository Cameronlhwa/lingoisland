import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HSK_PATH_STANDARD } from "@/lib/hsk/pathStandard";
import {
  CHECKLIST_DECOY_COUNT,
  CHECKLIST_WORDS_PER_LEVEL,
  scoreChecklist,
  shuffleInPlace,
  type ChecklistItem,
  type ChecklistWord,
} from "@/lib/hsk/placementChecklist";
import {
  loadWordsToSeedAsKnown,
  seedKnownHskWords,
} from "@/lib/hsk/seedKnownHskWords";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/hsk/placement-checklist
 * ~8 official HSK 2.0 words per level (1–6) + 9 decoys, shuffled.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const words: ChecklistWord[] = [];
    for (let level = 1; level <= 6; level++) {
      const { data, error } = await supabase
        .from("hsk_words")
        .select("id, hanzi, pinyin, level")
        .eq("standard", HSK_PATH_STANDARD)
        .eq("level", level)
        .eq("is_placeholder", false);
      if (error || !data || data.length === 0) {
        return NextResponse.json(
          { error: `Could not load HSK ${level} words` },
          { status: 500 },
        );
      }
      shuffleInPlace(data);
      words.push(
        ...data.slice(0, CHECKLIST_WORDS_PER_LEVEL).map((w) => ({
          id: w.id as string,
          hanzi: w.hanzi as string,
          pinyin: w.pinyin as string,
          level: w.level as number,
        })),
      );
    }

    const { data: decoyRows, error: decoyErr } = await supabase
      .from("hsk_placement_decoys")
      .select("id, hanzi, pinyin, difficulty_level");
    if (decoyErr || !decoyRows || decoyRows.length === 0) {
      return NextResponse.json(
        { error: "Placement decoys are not seeded yet" },
        { status: 500 },
      );
    }
    shuffleInPlace(decoyRows);
    const decoys = decoyRows.slice(0, CHECKLIST_DECOY_COUNT).map((d) => ({
      id: d.id as string,
      hanzi: d.hanzi as string,
      pinyin: d.pinyin as string,
    }));

    const items: ChecklistItem[] = shuffleInPlace([
      ...words.map((w) => ({ kind: "word" as const, ...w })),
      ...decoys.map((d) => ({ kind: "decoy" as const, ...d })),
    ]);

    return NextResponse.json({ items, words, decoys });
  } catch (e) {
    console.error("[hsk/placement-checklist GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}

type SubmitBody = {
  words?: ChecklistWord[];
  decoys?: { id: string }[];
  knownWordIds?: string[];
  knownDecoyIds?: string[];
};

/**
 * POST /api/hsk/placement-checklist
 * Scores the checklist, writes hsk_current_level / checklist source, seeds known cards.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as SubmitBody;
    const words = Array.isArray(body.words) ? body.words : [];
    const decoys = Array.isArray(body.decoys) ? body.decoys : [];
    const knownWordIds = Array.isArray(body.knownWordIds)
      ? body.knownWordIds.filter((id): id is string => typeof id === "string")
      : [];
    const knownDecoyIds = Array.isArray(body.knownDecoyIds)
      ? body.knownDecoyIds.filter((id): id is string => typeof id === "string")
      : [];

    if (words.length === 0) {
      return NextResponse.json({ error: "Missing checklist words" }, { status: 400 });
    }

    const wordIdSet = new Set(words.map((w) => w.id));
    const decoyIdSet = new Set(decoys.map((d) => d.id));
    const validKnownWords = knownWordIds.filter((id) => wordIdSet.has(id));
    const validKnownDecoys = knownDecoyIds.filter((id) => decoyIdSet.has(id));

    const { estimatedLevel, falsePositiveRate, rates } = scoreChecklist({
      words,
      knownWordIds: validKnownWords,
      knownDecoyIds: validKnownDecoys,
      decoyCount: Math.max(1, decoys.length),
    });

    await supabase.from("user_profiles").upsert(
      {
        user_id: user.id,
        product_track: "hsk",
        hsk_standard: HSK_PATH_STANDARD,
        hsk_current_level: estimatedLevel,
        hsk_level_source: "checklist",
      },
      { onConflict: "user_id" },
    );

    const toSeed = await loadWordsToSeedAsKnown(supabase, {
      estimatedLevel,
      extraWordIds: validKnownWords,
    });
    const { seeded } = await seedKnownHskWords(supabase, {
      userId: user.id,
      words: toSeed,
    });

    return NextResponse.json({
      estimatedLevel,
      falsePositiveRate,
      rates,
      seeded,
    });
  } catch (e) {
    console.error("[hsk/placement-checklist POST]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}
