import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateStory } from "@/lib/deepseek/generate-story";

type Body = {
  journeyNodeId?: string;
};

function normalizeLevel(raw: string | null | undefined) {
  if (!raw) return "B1";
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : "B1";
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
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
      .select("id, topic, user_id")
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
      .order("step_order", { ascending: true });

    if (nodesError || !nodes) {
      return NextResponse.json(
        { error: "Failed to load journey checkpoint" },
        { status: 500 },
      );
    }

    const targetNode = nodes.find((row) => row.id === journeyNodeId);
    if (!targetNode) {
      return NextResponse.json(
        { error: "Story checkpoint not found" },
        { status: 404 },
      );
    }

    if (targetNode.story_id) {
      return NextResponse.json({ storyId: targetNode.story_id });
    }

    const priorIslandNodes = nodes
      .filter((row) => {
        const stepOrder = Number(row.step_order ?? 0);
        const isStory = row.node_type
          ? row.node_type === "story"
          : stepOrder > 100;
        return !isStory && stepOrder < Number(targetNode.step_order ?? 0) && row.island_id;
      })
      .sort(
        (a, b) =>
          Number(b.step_order ?? 0) - Number(a.step_order ?? 0),
      );

    const completedPriorIslandIds = priorIslandNodes
      .filter((row) => !!row.completed_at)
      .map((row) => row.island_id)
      .filter((value): value is string => typeof value === "string");

    const fallbackPriorIslandIds = priorIslandNodes
      .map((row) => row.island_id)
      .filter((value): value is string => typeof value === "string");

    const priorIslandIds =
      completedPriorIslandIds.length > 0
        ? completedPriorIslandIds
        : fallbackPriorIslandIds;

    if (priorIslandIds.length === 0) {
      return NextResponse.json(
        { error: "No unlocked islands available for this checkpoint yet" },
        { status: 400 },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("cefr_level")
      .eq("id", user.id)
      .maybeSingle();

    const level = normalizeLevel(profile?.cefr_level);

    const { data: wordsData, error: wordsError } = await supabase
      .from("island_words")
      .select("id, hanzi, pinyin, english, island_id, position")
      .in("island_id", priorIslandIds);

    if (wordsError || !wordsData || wordsData.length === 0) {
      return NextResponse.json(
        { error: "No journey words found for this checkpoint" },
        { status: 400 },
      );
    }

    const islandPriority = new Map(
      priorIslandIds.map((id, index) => [id, index]),
    );
    const orderedWords = [...wordsData].sort((a, b) => {
      const islandDelta =
        (islandPriority.get(a.island_id) ?? Number.MAX_SAFE_INTEGER) -
        (islandPriority.get(b.island_id) ?? Number.MAX_SAFE_INTEGER);
      if (islandDelta !== 0) return islandDelta;
      return Number(a.position ?? 0) - Number(b.position ?? 0);
    });

    const selectedWords = orderedWords.slice(0, Math.min(15, orderedWords.length));
    const generated = await generateStory({
      topic: journey.topic.trim(),
      level,
      lengthChars: 300,
      targetWords: selectedWords,
      requestedWords: [],
      extraInstructions: `Make the story genuinely interesting and vivid, not flat. The title in the JSON should also be "${journey.topic.trim()}". Center the scene around "${targetNode.name}". ${targetNode.hint || targetNode.story_idea ? `Use this checkpoint idea for inspiration: ${targetNode.hint || targetNode.story_idea}.` : ""} The story should feel like an engaging travel moment, with a small twist, tension, or memorable detail.`,
    });

    const { data: inserted, error: insertError } = await supabase
      .from("stories")
      .insert({
        user_id: user.id,
        kind: "custom",
        date: null,
        title: journey.topic.trim(),
        level,
        length_chars: 300,
        topic: journey.topic.trim(),
        story_zh: generated.story_zh,
        story_en: generated.story_en,
        story_pinyin: generated.story_pinyin,
        source_island_ids: priorIslandIds,
        target_word_ids: selectedWords.map((word) => word.id),
        requested_words: [],
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      return NextResponse.json(
        { error: "Failed to create checkpoint story" },
        { status: 500 },
      );
    }

    await supabase
      .from("journey_islands")
      .update({ story_id: inserted.id })
      .eq("id", targetNode.id);

    return NextResponse.json({ storyId: inserted.id });
  } catch (error) {
    console.error("[journey/story-checkpoint]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to open story checkpoint",
      },
      { status: 500 },
    );
  }
}
