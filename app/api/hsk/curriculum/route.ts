import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { denyWithoutProductAccess } from "@/lib/product-access";
import { formatHskLevel } from "@/lib/utils/hsk";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/hsk/curriculum
 * The signed-in user's active "My HSK Path" curriculum plus its ordered units,
 * for the in-app curriculum overview.
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
    const denial = await denyWithoutProductAccess(user.id, "hsk");
    if (denial) return denial;

    const { data: curriculum } = await supabase
      .from("curricula")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (!curriculum) {
      return NextResponse.json({ curriculum: null, units: [] });
    }

    const { data: units } = await supabase
      .from("curriculum_units")
      .select(
        "id, unit_number, milestone_level, title, title_zh, theme, interest_tag, status, journey_id, completed_at",
      )
      .eq("curriculum_id", curriculum.id)
      .order("unit_number", { ascending: true });

    const currentUnit =
      (units ?? []).find((u) => u.status !== "completed") ?? null;

    return NextResponse.json({
      curriculum: {
        ...curriculum,
        current_level_label: formatHskLevel(curriculum.current_milestone_level),
        target_level_label: formatHskLevel(curriculum.target_level),
      },
      units: units ?? [],
      currentUnitId: currentUnit?.id ?? null,
    });
  } catch (e) {
    console.error("[hsk/curriculum GET]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
