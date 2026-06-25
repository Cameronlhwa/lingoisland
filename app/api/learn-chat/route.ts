import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type IncomingMessage = { role: "user" | "assistant"; content: string };

type LearnWord = { hanzi: string; pinyin: string; english: string };

type Body = {
  messages: IncomingMessage[];
  islandLevel: string;
  islandTopic: string;
  words: LearnWord[];
};

function getDeepSeekUrl() {
  const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").trim();
  const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalized}/v1/chat/completions`;
}

function getLevelTier(level: string): "beginner" | "intermediate" | "advanced" {
  const base = level.trim().toUpperCase().slice(0, 2);
  if (base === "A1" || base === "A2") return "beginner";
  if (base === "C1" || base === "C2") return "advanced";
  return "intermediate";
}

function buildSystemPrompt(
  tier: "beginner" | "intermediate" | "advanced",
  islandTopic: string,
  islandLevel: string,
  wordList: string,
): string {
  const base = `You are a friendly Mandarin tutor. Learner level: ${islandLevel}. Topic: ${islandTopic}.
Target words: ${wordList}

Formatting rules:
- Output plain text only. No markdown, bullets, or numbered lists.
- Keep responses concise and encouraging.`;

  if (tier === "beginner") {
    return `${base}

Give the user fill-in-the-blank sentences in English with the missing Chinese word.
Use the target words above. Keep responses short and encouraging.
After 3 exchanges, tell the user they've done great and end the practice.`;
  }

  if (tier === "intermediate") {
    return `${base}

Ask the user simple questions in Mandarin related to the topic.
Encourage them to use the target words in their responses.
Give brief, encouraging feedback after each response — note if they used a target word correctly.
After 3–4 exchanges, wrap up with a short summary of which words they used.`;
  }

  return `${base}

Have a natural conversation in Mandarin about the topic.
The user has just learned the target words — naturally work them into the conversation.
Gently note when the user uses them correctly.
After 4–5 exchanges, give a short usage report: which target words they used and how naturally.`;
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

    const body = (await request.json()) as Body;
    const { messages, islandLevel, islandTopic, words } = body;

    if (!islandLevel || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const wordList = words
      .map((w) => `${w.hanzi} (${w.pinyin}) — ${w.english}`)
      .join(", ");

    const tier = getLevelTier(islandLevel);
    const systemPrompt = buildSystemPrompt(
      tier,
      islandTopic || "daily life",
      islandLevel,
      wordList,
    );

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "DEEPSEEK_API_KEY not configured" },
        { status: 500 },
      );
    }

    const chatMessages: IncomingMessage[] =
      messages.length === 0
        ? [
            {
              role: "user",
              content:
                "Start the practice session now. Send your first message to the learner.",
            },
          ]
        : messages;

    const deepseekRes = await fetch(getDeepSeekUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          ...chatMessages,
        ],
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!deepseekRes.ok) {
      const t = await deepseekRes.text();
      return NextResponse.json(
        {
          error: `DeepSeek API error: ${deepseekRes.status}`,
          details: t,
        },
        { status: 502 },
      );
    }

    const data = await deepseekRes.json();
    const assistantMessage =
      data.choices?.[0]?.message?.content?.trim() ||
      "Let's practice! Try using one of your new words in a sentence.";

    return NextResponse.json({ message: assistantMessage });
  } catch (error) {
    console.error("Error in POST /api/learn-chat:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
