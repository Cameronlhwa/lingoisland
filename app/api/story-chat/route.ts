import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type IncomingMessage = { role: "user" | "assistant"; content: string };

type Body =
  | {
      storyId: string;
      action: "clear";
    }
  | {
      storyId: string;
      messages: IncomingMessage[];
      modelMode: "chat" | "thinking";
    };

function getDeepSeekUrl() {
  const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").trim();
  const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalized}/v1/chat/completions`;
}

async function getOrCreateThreadId({
  supabase,
  userId,
  storyId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  storyId: string;
}) {
  const { data: existing, error: existingErr } = await supabase
    .from("story_chat_threads")
    .select("id")
    .eq("user_id", userId)
    .eq("story_id", storyId)
    .maybeSingle();

  if (existing && existing.id) return existing.id as string;
  if (existingErr) {
    throw existingErr;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("story_chat_threads")
    .insert({ user_id: userId, story_id: storyId })
    .select("id")
    .single();

  if (insertErr) {
    const { data: retry } = await supabase
      .from("story_chat_threads")
      .select("id")
      .eq("user_id", userId)
      .eq("story_id", storyId)
      .single();
    if (retry?.id) return retry.id as string;
    throw insertErr;
  }

  return inserted.id as string;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const storyId = url.searchParams.get("storyId") || "";
    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    const { data: story, error: storyErr } = await supabase
      .from("stories")
      .select("id")
      .eq("id", storyId)
      .eq("user_id", user.id)
      .single();

    if (storyErr || !story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const threadId = await getOrCreateThreadId({
      supabase,
      userId: user.id,
      storyId,
    });

    const { data: msgs, error: msgErr } = await supabase
      .from("story_chat_messages")
      .select("id, role, content, model, created_at")
      .eq("thread_id", threadId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(100);

    if (msgErr) throw msgErr;

    return NextResponse.json({ threadId, messages: msgs || [] });
  } catch (error) {
    console.error("Error in GET /api/story-chat:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
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
    const storyId = (body as any).storyId as string;
    if (!storyId) {
      return NextResponse.json({ error: "Missing storyId" }, { status: 400 });
    }

    const { data: story, error: storyErr } = await supabase
      .from("stories")
      .select("id, title, level, story_zh")
      .eq("id", storyId)
      .eq("user_id", user.id)
      .single();

    if (storyErr || !story) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const threadId = await getOrCreateThreadId({
      supabase,
      userId: user.id,
      storyId,
    });

    if ((body as any).action === "clear") {
      const { error: delErr } = await supabase
        .from("story_chat_messages")
        .delete()
        .eq("thread_id", threadId)
        .eq("user_id", user.id);

      if (delErr) throw delErr;

      await supabase
        .from("story_chat_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", threadId)
        .eq("user_id", user.id);

      return NextResponse.json({ success: true });
    }

    const { messages, modelMode } = body as Exclude<
      Body,
      { storyId: string; action: "clear" }
    >;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Missing messages" }, { status: 400 });
    }

    const last = messages[messages.length - 1];
    const userContent = (last?.content || "").trim();
    if (last?.role !== "user" || !userContent) {
      return NextResponse.json(
        { error: "Last message must be a non-empty user message" },
        { status: 400 }
      );
    }

    const { error: insUserErr } = await supabase
      .from("story_chat_messages")
      .insert({
        thread_id: threadId,
        user_id: user.id,
        role: "user",
        content: userContent,
      });
    if (insUserErr) throw insUserErr;

    const { data: dbMsgs, error: dbMsgErr } = await supabase
      .from("story_chat_messages")
      .select("role, content")
      .eq("thread_id", threadId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(12);
    if (dbMsgErr) throw dbMsgErr;

    const history = (dbMsgs || []).slice().reverse();

    const model =
      modelMode === "thinking" ? "deepseek-reasoner" : "deepseek-chat";

    const systemPrompt = `You are a practical Mandarin tutor, but you must EXPLAIN IN ENGLISH ONLY.

Formatting rules (very important):
- Output plain text only.
- Do NOT use markdown of any kind (no **bold**, no headings, no code blocks).
- Do NOT use bullet points or numbered lists (no "-", no "•", no "1.").

Style:
- Keep answers concise and practical unless the user explicitly asks to go deep.
- Use clear, simple English matched to the learner level (${String(story.level || "B1")}).

If the user asks about vocabulary or sentences:
- Explain meaning and usage in English.
- Include register (formal/casual).
- Include 2-3 short example sentences in Chinese with pinyin inline.`;

    const contextMessage = `STORY\n- title: ${story.title}\n- level: ${story.level}\n- text: ${story.story_zh}`;

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
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Context:\n${contextMessage}` },
          ...history,
        ],
        temperature: modelMode === "thinking" ? 0.2 : 0.7,
        max_tokens: 1200,
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
    const reply = String(deepseekData.choices?.[0]?.message?.content || "").trim();

    if (!reply) {
      return NextResponse.json(
        { error: "No reply from model" },
        { status: 502 }
      );
    }

    const { error: insAsstErr } = await supabase
      .from("story_chat_messages")
      .insert({
        thread_id: threadId,
        user_id: user.id,
        role: "assistant",
        content: reply,
        model,
      });
    if (insAsstErr) throw insAsstErr;

    await supabase
      .from("story_chat_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", threadId)
      .eq("user_id", user.id);

    return NextResponse.json({ reply, threadId });
  } catch (error) {
    console.error("Error in POST /api/story-chat:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

