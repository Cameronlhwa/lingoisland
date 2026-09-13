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

export async function POST(_request: Request, { params }: { params: { id: string } }) {
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

  const { data: profile } = await supabase
    .from("pronunciation_profiles")
    .select("streak_count, streak_last_date")
    .eq("user_id", user.id)
    .maybeSingle();

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

  await supabase
    .from("pronunciation_profiles")
    .update({
      last_practiced_at: new Date().toISOString(),
      streak_count: streakCount,
      streak_last_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  return NextResponse.json({ streakCount });
}
