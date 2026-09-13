import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ALLOWED_HSK_LEVELS = new Set(["1", "2", "3", "4", "5", "6", "7-9"]);

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("pronunciation_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({ profile: profile ?? null });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { hskLevel, topics, customTopic, dailyMinutes } = body as {
    hskLevel?: string;
    topics?: string[];
    customTopic?: string | null;
    dailyMinutes?: number;
  };

  if (typeof hskLevel !== "string" || !ALLOWED_HSK_LEVELS.has(hskLevel)) {
    return NextResponse.json({ error: "Invalid hskLevel" }, { status: 400 });
  }
  if (!Array.isArray(topics) || topics.some((t) => typeof t !== "string")) {
    return NextResponse.json({ error: "Invalid topics" }, { status: 400 });
  }
  if (!Number.isFinite(dailyMinutes) || (dailyMinutes as number) <= 0) {
    return NextResponse.json({ error: "Invalid dailyMinutes" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("pronunciation_profiles")
    .select("user_id, onboarded_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: profile, error } = await supabase
    .from("pronunciation_profiles")
    .upsert({
      user_id: user.id,
      hsk_level: hskLevel,
      topics,
      custom_topic: typeof customTopic === "string" && customTopic.trim() ? customTopic.trim() : null,
      daily_minutes: dailyMinutes,
      onboarded_at: existing?.onboarded_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error || !profile) {
    console.error("[pronunciation/profile] upsert failed", error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }

  return NextResponse.json({ profile });
}
