import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Per-island HSK level badges for the Journey map. journey_island_hsk_words
 * is populated by journey generation tagging real islands with the HSK
 * words they teach — until that exists this just returns an empty map,
 * which is a safe no-op for the map UI.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: journey } = await supabase
      .from("journeys")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    const { data: islands } = await supabase
      .from("journey_islands")
      .select("id, island_id")
      .eq("journey_id", journey.id);

    const journeyIslandIds = (islands ?? []).map((i) => i.id);
    if (journeyIslandIds.length === 0) {
      return NextResponse.json({ levelsByIslandId: {} });
    }

    const { data: tags } = await supabase
      .from("journey_island_hsk_words")
      .select("journey_island_id, hsk_words(level)")
      .in("journey_island_id", journeyIslandIds);

    const levelByJourneyIslandId = new Map<string, number>();
    for (const tag of tags ?? []) {
      const level = (tag.hsk_words as unknown as { level: number } | null)?.level;
      if (typeof level === "number" && !levelByJourneyIslandId.has(tag.journey_island_id)) {
        levelByJourneyIslandId.set(tag.journey_island_id, level);
      }
    }

    const levelsByIslandId: Record<string, number> = {};
    for (const island of islands ?? []) {
      if (!island.island_id) continue;
      const level = levelByJourneyIslandId.get(island.id);
      if (typeof level === "number") {
        levelsByIslandId[island.island_id] = level;
      }
    }

    return NextResponse.json({ levelsByIslandId });
  } catch (e) {
    console.error("[journey/hsk-levels]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
