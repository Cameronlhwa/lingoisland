import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePronunciationDrill } from "@/lib/deepseek/generate-pronunciation-drill";

export const dynamic = "force-dynamic";

const ITEMS_PER_SESSION = 5;

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("pronunciation_profiles")
      .select("hsk_level, topics, custom_topic")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.hsk_level) {
      return NextResponse.json(
        { error: "Complete pronunciation placement first" },
        { status: 400 },
      );
    }

    const items = await generatePronunciationDrill({
      hskLevel: profile.hsk_level,
      topics: profile.topics ?? [],
      customTopic: profile.custom_topic,
      count: ITEMS_PER_SESSION,
    });

    const { data: session, error } = await supabase
      .from("pronunciation_sessions")
      .insert({
        user_id: user.id,
        source: "standalone",
        sentences: items,
        status: "in_progress",
      })
      .select("id")
      .single();

    if (error || !session) {
      console.error("[pronunciation/session] insert failed", error);
      return NextResponse.json({ error: "Failed to start practice session" }, { status: 500 });
    }

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error("[pronunciation/session] error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start practice session" },
      { status: 500 },
    );
  }
}
