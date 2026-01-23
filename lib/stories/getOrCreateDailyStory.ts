import type { SupabaseClient } from "@supabase/supabase-js";

type StoryRow = {
  id: string;
  user_id: string;
  kind: "daily" | "custom";
  date: string | null;
  title: string;
  level: string;
  length_chars: number;
  topic: string | null;
  story_zh: string;
  story_en: string | null;
  story_pinyin: string | null;
  source_island_ids: string[];
  target_word_ids: string[];
  created_at: string;
};

type IslandRow = { id: string; topic: string };
type WordRow = { id: string; hanzi: string; pinyin: string; english: string };

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function sample<T>(items: T[], count: number) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function countStoryChars(text: string) {
  return text.replace(/\s/g, "").length;
}

function stripCodeFence(content: string) {
  let jsonContent = content.trim();
  if (jsonContent.startsWith("```")) {
    jsonContent = jsonContent
      .replace(/^```(?:json)?\n/, "")
      .replace(/\n```$/, "");
  }
  return jsonContent;
}

function extractJsonObject(content: string) {
  const trimmed = stripCodeFence(content);
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return trimmed;
  }
  return trimmed.slice(start, end + 1);
}

async function generateDailyStory({
  topic,
  level,
  lengthChars,
  targetWords,
  sourceIslandIds,
  maxAttempts = 4,
}: {
  topic: string;
  level: string;
  lengthChars: number;
  targetWords: WordRow[];
  sourceIslandIds: string[];
  maxAttempts?: number;
}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }

  const targetWordList = targetWords.map((w) => w.hanzi).filter(Boolean);
  const basePrompt = `You are a Mandarin Chinese storyteller for language learners.

Topic: ${topic}
Learner level: ${level}
Target length: ${lengthChars} Chinese characters (count characters, not tokens)
Target words (optional to use): ${targetWordList.join(", ")}

Story requirements:
- 5-8 sentences
- Natural Chinese a native in their 20s would say
- Conversational, not textbook, not repetitive
- Use Simplified Chinese
- Not all target words need to be used; include only what fits naturally
- story_zh must be 100-200 characters and must not exceed 220 characters
- If story_zh is too short, add a sentence or detail

Output STRICT JSON only with this shape:
{
  "title": "...",
  "level": "${level}",
  "length_chars": ${lengthChars},
  "story_zh": "...",
  "story_en": null,
  "story_pinyin": null,
  "source_island_ids": ${JSON.stringify(sourceIslandIds)},
  "target_word_ids": ${JSON.stringify(targetWords.map((w) => w.id))}
}`;

  let lastError: Error | null = null;

  let extraNote = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const prompt = `${basePrompt}${extraNote ? `\n\n${extraNote}` : ""}`;
    const response = await fetch(
      "https://api.deepseek.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that generates structured JSON data for Chinese language learning. Always respond with valid JSON only, no markdown formatting.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.9,
          frequency_penalty: 0.6,
          presence_penalty: 0.2,
          max_tokens: 3000,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `DeepSeek API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      lastError = new Error("No content in DeepSeek response");
      continue;
    }

    let parsed: {
      title?: string;
      story_zh?: string;
      story_en?: string | null;
      story_pinyin?: string | null;
    };
    try {
      parsed = JSON.parse(extractJsonObject(content));
    } catch (error) {
      lastError = new Error(`Failed to parse DeepSeek JSON: ${error}`);
      extraNote =
        "Return STRICT JSON only. Do not include extra text or markdown.";
      continue;
    }

    if (!parsed.title || !parsed.story_zh) {
      lastError = new Error("Missing title or story_zh in DeepSeek output");
      continue;
    }

    const charCount = countStoryChars(parsed.story_zh);
    if (charCount < 100 || charCount > 220) {
      lastError = new Error(
        `story_zh length out of bounds: ${charCount} characters`
      );
      extraNote =
        "Adjust story_zh length to 100-200 Chinese characters and never exceed 220. Count characters carefully.";
      continue;
    }

    return {
      title: parsed.title.trim(),
      story_zh: parsed.story_zh.trim(),
      story_en: parsed.story_en?.trim() || null,
      story_pinyin: parsed.story_pinyin?.trim() || null,
    };
  }

  throw lastError || new Error("Failed to generate daily story");
}

async function selectDailyStoryContext({
  supabaseServerClient,
  userId,
  date,
}: {
  supabaseServerClient: SupabaseClient;
  userId: string;
  date: string;
}) {
  const { data: profile } = await supabaseServerClient
    .from("user_profiles")
    .select("cefr_level")
    .eq("user_id", userId)
    .maybeSingle();

  const level = profile?.cefr_level || "B1";

  const { data: islands, error: islandsError } = await supabaseServerClient
    .from("topic_islands")
    .select("id, topic")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (islandsError || !islands || islands.length === 0) {
    return null;
  }

  const { data: words, error: wordsError } = await supabaseServerClient
    .from("island_words")
    .select("id, hanzi, pinyin, english, island_id")
    .in("island_id", (islands as IslandRow[]).map((island) => island.id))
    .eq("user_id", userId);

  if (wordsError || !words || words.length === 0) {
    return null;
  }

  const wordsByIsland = new Map<string, WordRow[]>();
  for (const word of words as (WordRow & { island_id: string })[]) {
    if (!wordsByIsland.has(word.island_id)) {
      wordsByIsland.set(word.island_id, []);
    }
    wordsByIsland.get(word.island_id)!.push(word);
  }

  const eligibleIslands = (islands as IslandRow[]).filter((island) =>
    wordsByIsland.has(island.id)
  );

  if (eligibleIslands.length === 0) {
    return null;
  }

  const islandCount = eligibleIslands.length >= 2 ? 2 : 1;
  const selectedIslands = sample(eligibleIslands, islandCount);
  const islandIds = selectedIslands.map((island) => island.id);

  const selectedIslandWords = selectedIslands.flatMap(
    (island) => wordsByIsland.get(island.id) || []
  );

  const targetCount = Math.min(14, Math.max(10, 12));
  const selectedWords =
    selectedIslandWords.length <= targetCount
      ? selectedIslandWords
      : sample(selectedIslandWords, targetCount);

  const lengthChars = 140 + Math.floor(Math.random() * 40);
  const storyTopic =
    selectedIslands.map((island) => island.topic).join(", ") || "Daily life";

  return {
    level,
    islandIds,
    selectedWords,
    storyTopic,
    lengthChars,
  };
}

export async function getOrCreateDailyStory({
  supabaseServerClient,
  date,
}: {
  supabaseServerClient: SupabaseClient;
  date?: string;
}): Promise<StoryRow | null> {
  const {
    data: { user },
  } = await supabaseServerClient.auth.getUser();

  if (!user) {
    return null;
  }

  const targetDate = date || getTodayDate();

  await supabaseServerClient
    .from("stories")
    .delete()
    .eq("user_id", user.id)
    .eq("kind", "daily")
    .eq("saved", false)
    .lt("date", targetDate);

  const { data: existing } = await supabaseServerClient
    .from("stories")
    .select("*")
    .eq("user_id", user.id)
    .eq("kind", "daily")
    .eq("date", targetDate)
    .maybeSingle();

  if (existing) {
    return existing as StoryRow;
  }
  const context = await selectDailyStoryContext({
    supabaseServerClient,
    userId: user.id,
    date: targetDate,
  });

  if (!context) {
    return null;
  }

  try {
    const generated = await generateDailyStory({
      topic: context.storyTopic,
      level: context.level,
      lengthChars: context.lengthChars,
      targetWords: context.selectedWords,
      sourceIslandIds: context.islandIds,
    });

    const { data: inserted, error: insertError } = await supabaseServerClient
      .from("stories")
      .insert({
        user_id: user.id,
        kind: "daily",
        date: targetDate,
        title: generated.title,
        level: context.level,
        length_chars: context.lengthChars,
        topic: context.storyTopic,
        story_zh: generated.story_zh,
        story_en: generated.story_en,
        story_pinyin: generated.story_pinyin,
        source_island_ids: context.islandIds,
        target_word_ids: context.selectedWords.map((word) => word.id),
        requested_words: [],
        saved: false,
      })
      .select()
      .single();

    if (insertError) {
      const { data: fallback } = await supabaseServerClient
        .from("stories")
        .select("*")
        .eq("user_id", user.id)
        .eq("kind", "daily")
        .eq("date", targetDate)
        .maybeSingle();

      return (fallback as StoryRow) || null;
    }

    return inserted as StoryRow;
  } catch (error) {
    console.error("Daily story generation failed:", error);
    return null;
  }
}

