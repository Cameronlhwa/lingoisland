import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DIAGNOSTIC_ITEM_COUNT } from "@/lib/pronunciation/diagnosticBank";
import { sessionAverage } from "@/lib/pronunciation/sessionProgress";

export const dynamic = "force-dynamic";

const RECENT_SESSIONS_LOOKBACK = 30;
const HISTORY_LIMIT = 8;
const TREND_LIMIT = 7;

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function avgScores(rows: { overall_score: number | null }[]) {
  const scores = rows
    .map((r) => r.overall_score)
    .filter((s): s is number => typeof s === "number");
  if (scores.length === 0) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = todayUtc();

  const [
    { data: profile },
    { data: sessions },
    { count: sessionsCount },
    { count: sentencesCount },
    { data: day1Attempts },
    { data: remeasureAttempts },
    { count: todaySessions },
  ] = await Promise.all([
    supabase.from("pronunciation_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("pronunciation_sessions")
      .select("id, source, completed_at, sentences, summary")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(RECENT_SESSIONS_LOOKBACK),
    supabase
      .from("pronunciation_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed"),
    supabase
      .from("pronunciation_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("unit_type", "sentence"),
    supabase
      .from("pronunciation_diagnostic_attempts")
      .select("item_index, overall_score, audio_path")
      .eq("user_id", user.id)
      .eq("pass_label", "day1")
      .order("item_index", { ascending: true }),
    supabase
      .from("pronunciation_diagnostic_attempts")
      .select("item_index, overall_score, audio_path")
      .eq("user_id", user.id)
      .eq("pass_label", "remeasure")
      .order("item_index", { ascending: true }),
    supabase
      .from("pronunciation_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("completed_at", `${today}T00:00:00.000Z`),
  ]);

  const recentSessions = sessions ?? [];
  const sessionIds = recentSessions.map((s) => s.id);

  const { data: attempts } = sessionIds.length
    ? await supabase
        .from("pronunciation_attempts")
        .select("session_id, item_id, target_text, unit_type, overall_score, created_at")
        .in("session_id", sessionIds)
        .eq("unit_type","sentence")
        .order("created_at",{ascending:true})
    : { data: [] as { session_id:string; item_id:string|null;target_text:string;unit_type:string;overall_score:number|null;created_at:string }[] };

  const avgBySession = new Map<string, number>();
  for (const sessionId of sessionIds) {
    const session=recentSessions.find(s=>s.id===sessionId);
    const avg=typeof session?.summary?.avgScore==="number"?session.summary.avgScore:sessionAverage((attempts??[]).filter(a=>a.session_id===sessionId));
    if(avg!==null)avgBySession.set(sessionId,avg);
  }

  const history = recentSessions.slice(0, HISTORY_LIMIT).map((s) => ({
    id: s.id,
    source: s.source,
    completedAt: s.completed_at,
    itemCount: Array.isArray(s.sentences) ? s.sentences.length : 0,
    avgScore: avgBySession.get(s.id) ?? null,
  }));

  const trend = [...recentSessions]
    .filter((s) => avgBySession.has(s.id))
    .slice(0, TREND_LIMIT)
    .reverse()
    .map((s) => ({ date: s.completed_at, avgScore: avgBySession.get(s.id) as number }));

  const activeDays = new Set(recentSessions.map((s) => (s.completed_at ? dayKey(s.completed_at) : null)));
  const weeklyActivity = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return { date: key, practiced: activeDays.has(key) };
  });

  const day1Count = day1Attempts?.length ?? 0;
  const remeasureCount = remeasureAttempts?.length ?? 0;
  const baselineScore = avgScores(day1Attempts ?? []);
  const remeasureScore = avgScores(remeasureAttempts ?? []);

  const diagnosticCompleted = !!profile?.diagnostic_completed_at;
  const daysSinceDiagnostic = profile?.diagnostic_completed_at
    ? Math.floor(
        (Date.now() - new Date(profile.diagnostic_completed_at).getTime()) / 86_400_000,
      )
    : null;
  const progressCheckSuggested =
    diagnosticCompleted &&
    ((daysSinceDiagnostic !== null && daysSinceDiagnostic >= 14) || (sessionsCount ?? 0) >= 5);

  return NextResponse.json({
    profile: profile ?? null,
    history,
    trend,
    weeklyActivity,
    totals: {
      sessions: sessionsCount ?? 0,
      sentences: sentencesCount ?? 0,
    },
    practicedToday: (todaySessions ?? 0) > 0,
    baseline: {
      completed: diagnosticCompleted,
      score: baselineScore,
      day1Count,
      day1Total: DIAGNOSTIC_ITEM_COUNT,
      partialDay1: !diagnosticCompleted && day1Count > 0,
      remeasureCount,
      remeasureTotal: DIAGNOSTIC_ITEM_COUNT,
      partialRemeasure: diagnosticCompleted && remeasureCount > 0 && remeasureCount < DIAGNOSTIC_ITEM_COUNT,
      remeasureScore,
      progressCheckSuggested,
    },
  });
}
