import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type IncomingMessage = { role: "user" | "assistant"; content: string };

type Body =
  | {
      islandId: string;
      action: "clear";
    }
  | {
      islandId: string;
      messages: IncomingMessage[];
      modelMode: "chat" | "thinking";
      selectedWord?: { hanzi?: string; pinyin?: string; english?: string };
      selectedText?: string;
    };

function getDeepSeekUrl() {
  const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").trim();
  const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalized}/v1/chat/completions`;
}

async function getOrCreateThreadId({
  supabase,
  userId,
  islandId,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  islandId: string;
}) {
  const { data: existing, error: existingErr } = await supabase
    .from("island_chat_threads")
    .select("id")
    .eq("user_id", userId)
    .eq("island_id", islandId)
    .maybeSingle();

  if (existing && existing.id) return existing.id as string;
  if (existingErr) {
    throw existingErr;
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("island_chat_threads")
    .insert({ user_id: userId, island_id: islandId })
    .select("id")
    .single();

  if (insertErr) {
    // If a concurrent request inserted first, re-select
    const { data: retry } = await supabase
      .from("island_chat_threads")
      .select("id")
      .eq("user_id", userId)
      .eq("island_id", islandId)
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
    const islandId = url.searchParams.get("islandId") || "";
    if (!islandId) {
      return NextResponse.json({ error: "Missing islandId" }, { status: 400 });
    }

    // Verify ownership (also ensures island exists)
    const { data: island, error: islandErr } = await supabase
      .from("topic_islands")
      .select("id")
      .eq("id", islandId)
      .eq("user_id", user.id)
      .single();

    if (islandErr || !island) {
      return NextResponse.json({ error: "Island not found" }, { status: 404 });
    }

    const threadId = await getOrCreateThreadId({
      supabase,
      userId: user.id,
      islandId,
    });

    const { data: msgs, error: msgErr } = await supabase
      .from("island_chat_messages")
      .select("id, role, content, model, created_at")
      .eq("thread_id", threadId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(100);

    if (msgErr) throw msgErr;

    return NextResponse.json({ threadId, messages: msgs || [] });
  } catch (error) {
    console.error("Error in GET /api/island-chat:", error);
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
    const islandId = (body as any).islandId as string;
    if (!islandId) {
      return NextResponse.json({ error: "Missing islandId" }, { status: 400 });
    }

    // Verify ownership (also ensures island exists)
    const { data: island, error: islandErr } = await supabase
      .from("topic_islands")
      .select("id, topic, level, status")
      .eq("id", islandId)
      .eq("user_id", user.id)
      .single();

    if (islandErr || !island) {
      return NextResponse.json({ error: "Island not found" }, { status: 404 });
    }

    const threadId = await getOrCreateThreadId({
      supabase,
      userId: user.id,
      islandId,
    });

    if ((body as any).action === "clear") {
      const { error: delErr } = await supabase
        .from("island_chat_messages")
        .delete()
        .eq("thread_id", threadId)
        .eq("user_id", user.id);

      if (delErr) throw delErr;

      await supabase
        .from("island_chat_threads")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", threadId)
        .eq("user_id", user.id);

      return NextResponse.json({ success: true });
    }

    const { messages, modelMode, selectedWord, selectedText } = body as Exclude<
      Body,
      { islandId: string; action: "clear" }
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

    // Insert the user message (DB is the source of truth for history)
    const { error: insUserErr } = await supabase
      .from("island_chat_messages")
      .insert({
        thread_id: threadId,
        user_id: user.id,
        role: "user",
        content: userContent,
      });
    if (insUserErr) throw insUserErr;

    // Fetch island context (compact)
    const { data: words } = await supabase
      .from("island_words")
      .select("hanzi, pinyin, english, difficulty_tag")
      .eq("island_id", islandId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(30);

    const { data: sentences } = await supabase
      .from("island_sentences")
      .select("tier, hanzi, pinyin, english, grammar_tag")
      .eq("island_id", islandId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(20);

    // Fetch last ~12 messages from DB (includes the user message we just inserted)
    const { data: dbMsgs, error: dbMsgErr } = await supabase
      .from("island_chat_messages")
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
- Use clear, simple English matched to the learner level (${String(island.level || "B1")}).

If the user asks about vocabulary:
- Explain meaning and typical usage in English.
- Include register (formal/casual).
- Include 3 very short example sentences in Chinese characters (have pinyin under). If you include examples, keep them short and do not format them as bullets.

If the user asks about grammar:
- Explain the structure in English.
- Optionally include 2-3 very short example sentences in Chinese ONLY (no pinyin). If you include examples, keep them short and do not format them as bullets.`;

    const contextParts: string[] = [];
    contextParts.push(
      `TOPIC ISLAND\n- topic: ${island.topic}\n- level: ${island.level}\n- status: ${island.status}`
    );

    if (selectedWord?.hanzi || selectedText) {
      contextParts.push(
        `SELECTION\n- word: ${selectedWord?.hanzi || ""} ${selectedWord?.pinyin ? `(${selectedWord.pinyin})` : ""}${selectedWord?.english ? ` = ${selectedWord.english}` : ""}\n- selectedText: ${selectedText || ""}`.trim()
      );
    }

    if (words && words.length > 0) {
      contextParts.push(
        `WORDS (up to 30)\n${words
          .map((w) => {
            const diff = w.difficulty_tag ? ` [${w.difficulty_tag}]` : "";
            return `- ${w.hanzi} (${w.pinyin}) = ${w.english}${diff}`;
          })
          .join("\n")}`
      );
    }

    if (sentences && sentences.length > 0) {
      contextParts.push(
        `SENTENCES (up to 20)\n${sentences
          .map((s) => {
            const g = s.grammar_tag ? ` (grammar: ${s.grammar_tag})` : "";
            return `- [${s.tier}] ${s.hanzi} / ${s.pinyin} / ${s.english}${g}`;
          })
          .join("\n")}`
      );
    }

    const contextMessage = contextParts.join("\n\n");

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
      .from("island_chat_messages")
      .insert({
        thread_id: threadId,
        user_id: user.id,
        role: "assistant",
        content: reply,
        model,
      });
    if (insAsstErr) throw insAsstErr;

    await supabase
      .from("island_chat_threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", threadId)
      .eq("user_id", user.id);

    return NextResponse.json({ reply, threadId });
  } catch (error) {
    console.error("Error in POST /api/island-chat:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}


