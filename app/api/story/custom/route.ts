import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateStory } from "@/lib/deepseek/generate-story";

const LEVELS = ["A2", "B1", "B2", "C1"];

function normalizeRequestedWords(words: string[]) {
  return words
    .map((word) => word.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function pickTargetCount(lengthChars: number) {
  if (lengthChars <= 120) return 10;
  if (lengthChars >= 350) return 14;
  return 12;
}

function sample<T>(items: T[], count: number) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { topic, island_ids, requested_words, level, length_chars } = body;

    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    if (!Array.isArray(island_ids) || island_ids.length === 0) {
      return NextResponse.json(
        { error: "At least one topic island is required" },
        { status: 400 }
      );
    }

    if (!LEVELS.includes(level)) {
      return NextResponse.json(
        { error: "Level must be one of A2, B1, B2, C1" },
        { status: 400 }
      );
    }

    if (
      typeof length_chars !== "number" ||
      length_chars < 50 ||
      length_chars > 500
    ) {
      return NextResponse.json(
        { error: "length_chars must be between 50 and 500" },
        { status: 400 }
      );
    }

    const requestedWords = normalizeRequestedWords(
      Array.isArray(requested_words) ? requested_words : []
    );

    const { data: words, error: wordsError } = await supabase
      .from("island_words")
      .select("id, hanzi, pinyin, english, island_id")
      .in("island_id", island_ids);

    if (wordsError || !words || words.length === 0) {
      return NextResponse.json(
        { error: "No words found for selected islands" },
        { status: 400 }
      );
    }

    const requestedSet = new Set(
      requestedWords.map((word) => word.toLowerCase())
    );
    const matched = words.filter((word) => {
      const candidates = [
        word.hanzi,
        word.pinyin,
        word.english,
      ].filter(Boolean) as string[];
      return candidates.some((value) =>
        requestedSet.has(value.toLowerCase())
      );
    });

    const targetCount = pickTargetCount(length_chars);
    const remaining = words.filter(
      (word) => !matched.some((match) => match.id === word.id)
    );
    const fillCount = Math.max(
      0,
      Math.min(targetCount - matched.length, remaining.length)
    );

    const selectedWords = [
      ...matched,
      ...sample(remaining, fillCount),
    ].slice(0, targetCount);

    const generated = await generateStory({
      topic: topic.trim(),
      level,
      lengthChars: length_chars,
      targetWords: selectedWords,
      requestedWords,
    });

    const { data: inserted, error: insertError } = await supabase
      .from("stories")
      .insert({
        user_id: user.id,
        kind: "custom",
        date: null,
        title: generated.title,
        level,
        length_chars,
        topic: topic.trim(),
        story_zh: generated.story_zh,
        story_en: generated.story_en,
        story_pinyin: generated.story_pinyin,
        source_island_ids: island_ids,
        target_word_ids: selectedWords.map((word) => word.id),
        requested_words: requestedWords,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create story" },
        { status: 500 }
      );
    }

    return NextResponse.json({ story: inserted });
  } catch (error) {
    console.error("Error in POST /api/story/custom:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

