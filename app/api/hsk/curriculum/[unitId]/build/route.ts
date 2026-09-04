import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { denyWithoutProductAccess } from "@/lib/product-access";
import { buildCurriculumUnit } from "@/lib/hsk/buildCurriculumUnit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/hsk/curriculum/[unitId]/build
 * Turns a sketched curriculum unit into a real journey (islands + supporting
 * vocab + story checkpoints). Called when the learner opens the next unit.
 * Only the current (first non-completed) unit may be built.
 */
export async function POST(
  _request: Request,
  { params }: { params: { unitId: string } },
) {
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

    const { data: unit } = await supabase
      .from("curriculum_units")
      .select("id, unit_number, status, journey_id, curriculum_id, curricula!inner(user_id)")
      .eq("id", params.unitId)
      .maybeSingle();

    const ownerRel = (unit?.curricula ?? null) as unknown;
    const owner = (Array.isArray(ownerRel) ? ownerRel[0] : ownerRel) as
      | { user_id: string }
      | null;
    if (!unit || !owner || owner.user_id !== user.id) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    if (unit.status === "ready" && unit.journey_id) {
      return NextResponse.json({ journeyId: unit.journey_id, alreadyBuilt: true });
    }

    // Guard: don't let a learner build ahead of where they are.
    const { data: earlierIncomplete } = await supabase
      .from("curriculum_units")
      .select("id")
      .eq("curriculum_id", unit.curriculum_id)
      .lt("unit_number", unit.unit_number)
      .neq("status", "completed")
      .limit(1);
    if ((earlierIncomplete ?? []).length > 0) {
      return NextResponse.json(
        { error: "Finish the earlier units first" },
        { status: 409 },
      );
    }

    const built = await buildCurriculumUnit(supabase, {
      unitId: params.unitId,
      userId: user.id,
    });
    if (!built.ok) {
      return NextResponse.json({ error: built.error }, { status: 500 });
    }

    return NextResponse.json({ journeyId: built.journeyId });
  } catch (e) {
    console.error("[hsk/curriculum/build]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}
