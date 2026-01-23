import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getDeepSeekUrl() {
  const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").trim();
  const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalized}/v1/chat/completions`;
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
    const text = body?.text;
    const storyId = body?.storyId;

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "DEEPSEEK_API_KEY not configured" },
        { status: 500 }
      );
    }

    const deepseekRes = await fetch(getDeepSeekUrl(), {
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
              "You are a helpful translator. Translate the Chinese text to natural English. Return only the English translation.",
          },
          {
            role: "user",
            content: text,
          },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!deepseekRes.ok) {
      const t = await deepseekRes.text();
      return NextResponse.json(
        {
          error: `DeepSeek API error: ${deepseekRes.status} ${deepseekRes.statusText}`,
          details: t,
        },
        { status: 502 }
      );
    }

    const deepseekData = await deepseekRes.json();
    const english = String(
      deepseekData.choices?.[0]?.message?.content || ""
    ).trim();

    if (!english) {
      return NextResponse.json(
        { error: "No English translation returned" },
        { status: 502 }
      );
    }

    if (storyId) {
      await supabase
        .from("stories")
        .update({ story_en: english })
        .eq("id", storyId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({ english });
  } catch (error) {
    console.error("Error in POST /api/story/english:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

