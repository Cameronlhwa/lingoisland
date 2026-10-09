import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function isYesterday(dateStr: string, today: string) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const t = new Date(`${today}T00:00:00Z`);
  const diffDays = Math.round((t.getTime() - d.getTime()) / 86_400_000);
  return diffDays === 1;
}

export async function POST(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: session, error: sessionError } = await supabase
    .from("pronunciation_sessions")
    .select("id")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Practice session not found" }, { status: 404 });
  }

  await supabase
    .from("pronunciation_sessions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", params.id);

  const [{ data: profile }, { data: attempts }] = await Promise.all([
    supabase
      .from("pronunciation_profiles")
      .select("streak_count, streak_last_date, overall_score")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase.from("pronunciation_attempts").select("overall_score, unit_type").eq("session_id", params.id),
  ]);

  const today = todayUtc();
  let streakCount = profile?.streak_count ?? 0;
  const lastDate = profile?.streak_last_date ?? null;

  if (lastDate === today) {
    // Already practiced today — streak unchanged.
  } else if (lastDate && isYesterday(lastDate, today)) {
    streakCount += 1;
  } else {
    streakCount = 1;
  }

  // Blend this session's average into the rolling profile score so recent
  // performance moves it without one noisy session swinging it wildly.
  // (Per-character weak-sound tracking happens live in /api/pronunciation/score,
  // not here — see lib/pronunciation/weakSoundsStore.ts.)
  const scored = (attempts ?? [])
    .filter((a) => a.unit_type === "sentence")
    .map((a) => a.overall_score)
    .filter((score): score is number => typeof score === "number");
  const sessionAvg = scored.length > 0 ? scored.reduce((s, v) => s + v, 0) / scored.length : null;
  const existingScore = typeof profile?.overall_score === "number" ? profile.overall_score : null;
  const overallScore =
    sessionAvg === null ? existingScore : existingScore === null ? sessionAvg : existingScore * 0.7 + sessionAvg * 0.3;

  await supabase.from("pronunciation_profiles").upsert(
    {
      user_id: user.id,
      last_practiced_at: new Date().toISOString(),
      streak_count: streakCount,
      streak_last_date: today,
      ...(overallScore !== null ? { overall_score: Math.round(overallScore * 10) / 10 } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  return NextResponse.json({ streakCount });
}
