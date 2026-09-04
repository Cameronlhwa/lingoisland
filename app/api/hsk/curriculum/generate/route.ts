import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCurriculumForUser } from "@/lib/hsk/curriculum";
import { buildCurriculumUnit } from "@/lib/hsk/buildCurriculumUnit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/hsk/curriculum/generate
 *
 * Creates the user's "My HSK Path" curriculum from their stored HSK onboarding
 * answers (target level, motivation, interests, personalization), sketches the
 * first milestone level's units, and fully builds Unit 1. Allowlisted in
 * middleware so it can run during pre-checkout onboarding (like
 * /api/hsk/journey/generate). Access to the built units is still gated by the
 * app layout / entitlements.
 *
 * Body: { force?: boolean }  — force re-creates even if an active curriculum exists.
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

    const body = (await request.json().catch(() => ({}))) as { force?: boolean };

    if (!body.force) {
      const { data: existing } = await supabase
        .from("curricula")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      if (existing) {
        return await respondWithCurriculum(supabase, user.id, existing.id as string);
      }
    }

    const created = await createCurriculumForUser(supabase, { userId: user.id });
    if (!created.ok) {
      return NextResponse.json({ error: created.error }, { status: 400 });
    }

    // Build Unit 1 synchronously so onboarding lands on a ready unit.
    const { data: firstUnit } = await supabase
      .from("curriculum_units")
      .select("id")
      .eq("curriculum_id", created.curriculumId)
      .eq("unit_number", 1)
      .maybeSingle();

    let unit1JourneyId: string | null = null;
    if (firstUnit) {
      const built = await buildCurriculumUnit(supabase, {
        unitId: firstUnit.id as string,
        userId: user.id,
      });
      if (built.ok) unit1JourneyId = built.journeyId;
      else console.warn("[curriculum/generate] Unit 1 build failed", built.error);
    }

    return await respondWithCurriculum(
      supabase,
      user.id,
      created.curriculumId,
      unit1JourneyId,
    );
  } catch (e) {
    console.error("[hsk/curriculum/generate]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}

async function respondWithCurriculum(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  curriculumId: string,
  unit1JourneyId?: string | null,
) {
  const { data: curriculum } = await supabase
    .from("curricula")
    .select("*")
    .eq("id", curriculumId)
    .maybeSingle();

  const { data: units } = await supabase
    .from("curriculum_units")
    .select(
      "id, unit_number, milestone_level, title, title_zh, theme, interest_tag, status, journey_id, completed_at",
    )
    .eq("curriculum_id", curriculumId)
    .order("unit_number", { ascending: true });

  const resolvedUnit1Journey =
    unit1JourneyId ??
    ((units ?? []).find((u) => u.unit_number === 1)?.journey_id as string | null) ??
    null;

  return NextResponse.json({
    curriculum,
    units: units ?? [],
    unit1JourneyId: resolvedUnit1Journey,
  });
}
