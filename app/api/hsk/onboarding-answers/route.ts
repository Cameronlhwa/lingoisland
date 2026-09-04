import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { HSK_PATH_STANDARD } from "@/lib/hsk/pathStandard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MOTIVATIONS = ["school", "job", "heritage", "hobby"];
const LEVEL_SOURCES = ["official", "checklist"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type Body = {
  currentLevel?: number;
  levelSource?: string;
  targetLevel?: number;
  motivation?: string;
  personalizationText?: string;
  interests?: string[];
  dailyTimeMinutes?: number;
  testDate?: string | null;
};

/**
 * POST /api/hsk/onboarding-answers
 * Persists the HSK onboarding / "My HSK Path" setup answers onto user_profiles.
 * Allowlisted in middleware so it can run before checkout during onboarding.
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

    const body = (await request.json().catch(() => ({}))) as Body;

    const updates: Record<string, unknown> = {
      user_id: user.id,
      product_track: "hsk",
      hsk_standard: HSK_PATH_STANDARD,
    };

    if (Number.isInteger(body.currentLevel) && (body.currentLevel as number) >= 1 && (body.currentLevel as number) <= 6) {
      updates.hsk_current_level = body.currentLevel;
    }
    if (typeof body.levelSource === "string" && LEVEL_SOURCES.includes(body.levelSource)) {
      updates.hsk_level_source = body.levelSource;
    }
    if (Number.isInteger(body.targetLevel) && (body.targetLevel as number) >= 1 && (body.targetLevel as number) <= 6) {
      updates.hsk_target_level = body.targetLevel;
    }
    if (typeof body.motivation === "string" && MOTIVATIONS.includes(body.motivation)) {
      updates.hsk_motivation = body.motivation;
    }
    if (typeof body.personalizationText === "string") {
      updates.hsk_personalization_text = body.personalizationText.trim();
    }
    if (Array.isArray(body.interests)) {
      const cleaned = body.interests
        .filter((i): i is string => typeof i === "string" && i.trim().length > 0)
        .slice(0, 20);
      if (cleaned.length > 0 && cleaned.length < 5) {
        return NextResponse.json(
          { error: "Pick at least five interests" },
          { status: 400 },
        );
      }
      updates.interests = cleaned;
    }
    if (typeof body.dailyTimeMinutes === "number" && body.dailyTimeMinutes > 0) {
      updates.daily_time_minutes = Math.round(body.dailyTimeMinutes);
    }
    if (body.testDate === null) {
      updates.test_date = null;
    } else if (typeof body.testDate === "string" && DATE_RE.test(body.testDate)) {
      updates.test_date = body.testDate;
    }

    const { error } = await supabase
      .from("user_profiles")
      .upsert(updates, { onConflict: "user_id" });

    if (error) {
      console.error("[hsk/onboarding-answers] upsert", error);
      return NextResponse.json({ error: "Failed to save answers" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[hsk/onboarding-answers]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
}
