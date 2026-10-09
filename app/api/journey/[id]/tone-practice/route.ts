import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generatePronunciationSentencesForWords } from "@/lib/deepseek/generate-pronunciation-drill";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WORDS_PER_SESSION = 5;

type Body = {
  journeyNodeId?: string;
};

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Body;
    const journeyNodeId = body.journeyNodeId;
    if (!journeyNodeId) {
      return NextResponse.json(
        { error: "journeyNodeId is required" },
        { status: 400 },
      );
    }

    const { data: journey } = await supabase
      .from("journeys")
      .select("id, user_id")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!journey) {
      return NextResponse.json({ error: "Journey not found" }, { status: 404 });
    }

    const { data: nodes, error: nodesError } = await supabase
      .from("journey_islands")
      .select("*")
      .eq("journey_id", params.id)
      .order("position", { ascending: true });

    if (nodesError || !nodes) {
      return NextResponse.json(
        { error: "Failed to load journey" },
        { status: 500 },
      );
    }

    const targetNode = nodes.find((row) => row.id === journeyNodeId);
    if (!targetNode || targetNode.node_type !== "tone_practice") {
      return NextResponse.json(
        { error: "Pronunciation checkpoint not found" },
        { status: 404 },
      );
    }

    if (targetNode.pronunciation_session_id) {
      return NextResponse.json({ sessionId: targetNode.pronunciation_session_id });
    }

    // The checkpoint always sits right after the island it reinforces — find the
    // most recent completed island ahead of it in the path.
    const sourceIsland = nodes
      .filter(
        (row) =>
          row.node_type === "island" &&
          Number(row.position ?? 0) < Number(targetNode.position ?? 0) &&
          row.island_id,
      )
      .sort((a, b) => Number(b.position ?? 0) - Number(a.position ?? 0))[0];

    if (!sourceIsland?.island_id) {
      return NextResponse.json(
        { error: "No completed island to practice yet" },
        { status: 400 },
      );
    }

    const { data: wordsData, error: wordsError } = await supabase
      .from("island_words")
      .select("hanzi, pinyin, english, position")
      .eq("island_id", sourceIsland.island_id)
      .order("position", { ascending: true });

    if (wordsError || !wordsData || wordsData.length === 0) {
      return NextResponse.json(
        { error: "No words found for this island" },
        { status: 400 },
      );
    }

    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("cefr_level")
      .eq("user_id", user.id)
      .maybeSingle();
    const level = userProfile?.cefr_level?.trim() || "B1";

    const selectedWords = wordsData.slice(0, WORDS_PER_SESSION);
    const items = await generatePronunciationSentencesForWords({
      words: selectedWords.map((word) => ({
        hanzi: word.hanzi,
        pinyin: word.pinyin,
        english: word.english,
      })),
      level,
    });

    const { data: session, error: sessionError } = await supabase
      .from("pronunciation_sessions")
      .insert({
        user_id: user.id,
        journey_island_id: targetNode.id,
        source: "journey_node",
        sentences: items,
        status: "in_progress",
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      console.error("[journey/tone-practice] insert session", sessionError);
      return NextResponse.json(
        { error: "Failed to start pronunciation practice" },
        { status: 500 },
      );
    }

    const { data: claimed } = await supabase
      .from("journey_islands")
      .update({ pronunciation_session_id: session.id })
      .eq("id", targetNode.id)
      .is("pronunciation_session_id", null)
      .select("pronunciation_session_id")
      .maybeSingle();

    if (!claimed) {
      const { data: winner } = await supabase
        .from("journey_islands")
        .select("pronunciation_session_id")
        .eq("id", targetNode.id)
        .maybeSingle();
      await supabase
        .from("pronunciation_sessions")
        .update({ status: "abandoned" })
        .eq("id", session.id);
      if (winner?.pronunciation_session_id) {
        return NextResponse.json({ sessionId: winner.pronunciation_session_id });
      }
    }

    await supabase.from("pronunciation_profiles").upsert(
      { user_id: user.id, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error("[journey/tone-practice]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to start pronunciation practice",
      },
      { status: 500 },
    );
  }
}
