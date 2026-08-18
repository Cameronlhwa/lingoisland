import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

type IncomingMessage = { role: "user" | "assistant"; content: string };

type LearnWord = { hanzi: string; pinyin: string; english: string };

type Body = {
  messages: IncomingMessage[];
  islandLevel: string;
  islandTopic?: string;
  words: LearnWord[];
  mode?: "exercise" | "chat";
};

const MAX_MESSAGES = 20;
const MAX_CONTENT_LENGTH = 2000;

function getDeepSeekUrl() {
  const base = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").trim();
  const normalized = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${normalized}/v1/chat/completions`;
}

function getLevelTier(level: string): "beginner" | "intermediate" | "advanced" {
  const base = level.trim().toUpperCase().slice(0, 2);
  if (base === "A0" || base === "A1" || base === "A2") return "beginner";
  if (base === "C1" || base === "C2") return "advanced";
  return "intermediate";
}

function buildScenario(
  topic: string,
  tier: "intermediate" | "advanced",
): { setup: string; role: string } {
  const t = topic.toLowerCase();

  // Banking / Finance
  if (
    t.includes("bank") ||
    t.includes("finance") ||
    t.includes("money") ||
    t.includes("银行")
  ) {
    return tier === "intermediate"
      ? {
          role: "a friendly bank teller at 华华银行",
          setup:
            "You are a friendly bank teller at 华华银行 (Huahua Bank). The learner has just walked in to open a new account. Greet them warmly and help them through the process naturally — ask what kind of account they want, if they want a debit card, etc.",
        }
      : {
          role: "a financial advisor at 华华银行",
          setup:
            "You are a financial advisor at 华华银行. The learner wants to discuss their savings and possibly make a transfer. Have a natural professional-but-friendly conversation about their financial situation.",
        };
  }

  // Animals / Nature
  if (
    t.includes("animal") ||
    t.includes("动物") ||
    t.includes("nature") ||
    t.includes("zoo") ||
    t.includes("动物园")
  ) {
    return {
      role: "a zookeeper at 华华动物园",
      setup:
        "You are a cheerful zookeeper at 华华动物园 (Huahua Zoo). The learner has just arrived. Welcome them and start chatting about the animals — ask which ones they're excited to see, share fun facts, ask if they have a favourite animal.",
    };
  }

  // Food / Restaurant / Cooking
  if (
    t.includes("food") ||
    t.includes("restaurant") ||
    t.includes("cook") ||
    t.includes("cafe") ||
    t.includes("coffee") ||
    t.includes("eat") ||
    t.includes("饮食") ||
    t.includes("餐厅") ||
    t.includes("咖啡")
  ) {
    return tier === "intermediate"
      ? {
          role: "a friendly café owner",
          setup:
            "You are the friendly owner of 华华咖啡 (Huahua Café). The learner has just sat down. Welcome them, ask what they'd like to drink, chat about the menu and what you recommend today.",
        }
      : {
          role: "a chef and food lover",
          setup:
            "You are 华华, a passionate home chef. You've invited the learner over for dinner. Chat naturally about what you're cooking, ask about their favourite foods and cooking habits.",
        };
  }

  // Travel / Transport
  if (
    t.includes("travel") ||
    t.includes("transport") ||
    t.includes("metro") ||
    t.includes("taxi") ||
    t.includes("旅游") ||
    t.includes("交通")
  ) {
    return {
      role: "a local guide",
      setup:
        "You are a friendly local guide in a Chinese city. The learner has just arrived and wants to get around. Help them figure out how to get somewhere, chat about the best ways to travel around the city.",
    };
  }

  // Work / Business / Office
  if (
    t.includes("work") ||
    t.includes("business") ||
    t.includes("office") ||
    t.includes("职场") ||
    t.includes("工作") ||
    t.includes("商务")
  ) {
    return {
      role: "a friendly colleague",
      setup:
        "You are 华华, a friendly colleague at the same company as the learner. You've just run into each other in the office kitchen. Chat naturally about work, what you're both up to, upcoming meetings or projects.",
    };
  }

  // Shopping
  if (
    t.includes("shop") ||
    t.includes("mall") ||
    t.includes("购物") ||
    t.includes("买")
  ) {
    return {
      role: "a friendly shop assistant",
      setup:
        "You are a helpful shop assistant at a popular store. The learner has just walked in. Greet them and ask what they're looking for today — chat naturally about the products, help them find what they need.",
    };
  }

  // Health / Hospital / Doctor
  if (
    t.includes("health") ||
    t.includes("hospital") ||
    t.includes("doctor") ||
    t.includes("医院") ||
    t.includes("医生") ||
    t.includes("健康")
  ) {
    return {
      role: "a friendly doctor at 华华诊所",
      setup:
        "You are a warm, reassuring doctor at 华华诊所 (Huahua Clinic). The learner has come in for a check-up. Ask how they're feeling, chat about their health and lifestyle in a natural, friendly way.",
    };
  }

  // Kpop / Music / Entertainment
  if (
    t.includes("kpop") ||
    t.includes("music") ||
    t.includes("concert") ||
    t.includes("音乐") ||
    t.includes("娱乐")
  ) {
    return {
      role: "a fellow music fan",
      setup:
        "You are 华华, a huge music fan who loves chatting about your favourite artists and songs. Start a natural fan conversation — ask what the learner is listening to lately, share what you've been into, discuss upcoming concerts.",
    };
  }

  // Technology / AI
  if (
    t.includes("tech") ||
    t.includes("ai") ||
    t.includes("computer") ||
    t.includes("科技") ||
    t.includes("人工智能") ||
    t.includes("电脑")
  ) {
    return {
      role: "a tech-enthusiast friend",
      setup:
        "You are 华华, a tech enthusiast who loves talking about the latest gadgets and AI tools. Start a casual conversation — ask what devices or apps the learner uses, share what you've been excited about lately.",
    };
  }

  // Sports / Fitness
  if (
    t.includes("sport") ||
    t.includes("fitness") ||
    t.includes("gym") ||
    t.includes("运动") ||
    t.includes("健身")
  ) {
    return {
      role: "a gym buddy",
      setup:
        "You are 华华, the learner's gym buddy. You've just finished a workout together. Chat naturally about your training, what exercises you did, how often you work out, and fitness goals.",
    };
  }

  // Default fallback — generic friendly conversation
  return {
    role: "a friendly conversationalist",
    setup: `You are 华华, a friendly capybara who loves chatting about ${topic}. Start a warm, genuine conversation on this topic — ask the learner about their experiences and opinions, share your own thoughts, keep it natural and interesting.`,
  };
}

function buildSystemPrompt(
  tier: "beginner" | "intermediate" | "advanced",
  islandTopic: string,
  islandLevel: string,
  wordList: string,
): string {
  if (tier === "beginner") {
    return `You are 华华, a friendly and encouraging capybara who loves chatting about ${islandTopic}. 
You're helping a beginner (${islandLevel}) practice 5 new words through fill-in-the-blank exercises.

The 5 words to practice are: ${wordList}

Your opening message must:
- Start with a warm, casual 1-sentence comment in English about ${islandTopic} that feels genuine and conversational (e.g. for cooking: "I made dumplings this morning and almost forgot to add the filling 😅")
- Then say something like "Let's practice your new words! Fill in the blank:"
- Then immediately give the FIRST exercise sentence

For each of the 3 exercises, provide:
1. A simple Chinese sentence using one of the 5 target words, with the target word replaced by ___
2. On the next line, the full Pinyin of the sentence with ___ where the missing word goes
3. On the next line in brackets: [ANSWER: hanzi|pinyin] so the UI can parse the correct answer
4. On the next line: [OPTIONS: hanzi1|pinyin1, hanzi2|pinyin2, hanzi3|pinyin3, hanzi4|pinyin4] — the correct answer plus 3 plausible distractors from the word list

Example format for one exercise:
我想学___，但是还不会。
Wǒ xiǎng xué ___, dànshì hái bù huì.
[ANSWER: 做饭|zuò fàn]
[OPTIONS: 做饭|zuò fàn, 切菜|qiē cài, 炒|chǎo, 蒸|zhēng]

After the user selects an answer:
- If correct: say "正确！(Correct!) 🎉" + one short encouraging line in English, then give the next exercise in the same format
- If wrong: say "Not quite! The answer is [correct word] ([pinyin])." + one short tip, then move to the next exercise anyway
- After the 3rd exercise: say "好极了！(Amazing!) You practiced [X] out of 3 correctly. 华华 is proud of you! 🦫" and stop — do not continue

Keep all instructions and feedback in English. Only the exercise sentences and 正确/好极了 are in Chinese.
Never deviate from the [ANSWER:] and [OPTIONS:] format — the UI depends on parsing these exactly.`;
  }

  if (tier === "intermediate") {
    const scenario = buildScenario(islandTopic, "intermediate");
    return `You are 华华, a friendly capybara. ${scenario.setup}

The learner is ${islandLevel} level. Have a natural conversation entirely in Mandarin.
Weave these words into the conversation naturally — never mention them by name or ask the learner to use them: ${wordList}

CRITICAL RULES:
- Never say things like "可以用X这个词吗", "试着用X说说", "用X造句", or any instruction to use a specific word. That kills the immersion.
- Stay in character as ${scenario.role} at all times.
- Ask genuine questions that a real person in this situation would ask.
- When the learner uses a target word correctly, react naturally to what they said — don't announce that they used it correctly.
- Keep your messages to 2-3 sentences maximum.
- After 4 exchanges total, wrap up the conversation naturally and say goodbye warmly. End with: 再见！很高兴和你聊天！🦫

Formatting: plain text only, no markdown, no bullet points.`;
  }

  const scenario = buildScenario(islandTopic, "advanced");
  return `You are 华华, a friendly capybara. ${scenario.setup}

The learner is ${islandLevel} level. Have a rich, natural conversation entirely in Mandarin.
Weave these words into the conversation naturally — never reference them as study targets: ${wordList}

CRITICAL RULES:
- Never instruct the learner to use any specific word. Never mention the word list.
- Stay in character as ${scenario.role} at all times.
- Use the target words naturally in YOUR own messages when appropriate.
- React to what the learner actually says — follow the conversation where it goes.
- Keep messages to 3-4 sentences maximum.
- After 5 exchanges, wrap up warmly and naturally. End with: 下次再聊！🦫

Formatting: plain text only, no markdown.`;
}

function buildExerciseSystemPrompt(
  islandTopic: string,
  islandLevel: string,
  wordList: string,
): string {
  return `You are 华华, a friendly capybara having a real conversation in Chinese with a ${islandLevel} Mandarin learner about ${islandTopic}.

Words to practice: ${wordList}

Return a JSON object only. No markdown, no backticks, no explanation. Raw JSON only.

{
  "opener": "1-2 warm casual sentences in English about ${islandTopic}. End with: Let's practice your new words!",
  "exchanges": [
    {
      "huahuaHanzi": "A genuine, specific question or comment 华华 would say in a real conversation",
      "huahuaPinyin": "full pinyin of 华华's message",
      "replyHanzi": "A natural first-person reply that DIRECTLY answers 华华's question, with the target word replaced by ___",
      "replyPinyin": "full pinyin of the reply with ___ where the word goes",
      "correctHanzi": "the missing word hanzi",
      "correctPinyin": "the missing word pinyin",
      "options": [
        { "hanzi": "correct word", "pinyin": "correct pinyin" },
        { "hanzi": "distractor 1", "pinyin": "distractor pinyin" },
        { "hanzi": "distractor 2", "pinyin": "distractor pinyin" },
        { "hanzi": "distractor 3", "pinyin": "distractor pinyin" }
      ]
    }
  ]
}

CRITICAL RULES — read carefully:

1. huahuaHanzi MUST be a real, specific question or comment — NEVER a meta-instruction like "选一个字" (pick a word) or "完成句子" (complete the sentence) or "填空" (fill in the blank). 华华 is having a conversation, not giving a worksheet instruction.

2. replyHanzi MUST directly and logically answer what 华华 just said. If 华华 asks about friends, the reply must be about friends. If 华华 makes a comment, the reply must respond to that specific comment. The reply and the question must form a coherent two-line conversation that makes sense if you removed the blank entirely.

3. BAD example (do not do this):
   huahuaHanzi: "选一个字，完成下面的句子："  ← WRONG, this is an instruction not a question
   replyHanzi: "你很高兴。" ← WRONG, doesn't respond to anything

4. GOOD example (follow this pattern):
   huahuaHanzi: "你有中国朋友吗？"
   huahuaPinyin: "Nǐ yǒu Zhōngguó péngyǒu ma?"
   replyHanzi: "有！我的___是中国人。"
   replyPinyin: "Yǒu! Wǒ de ___ shì Zhōngguó rén."
   correctHanzi: "朋友"
   correctPinyin: "péngyǒu"

5. Every huahuaHanzi must end in a question mark (？) or be a comment that clearly invites a specific response — never a generic instruction.

6. Use 3 different words from the word list across the 3 exchanges.

7. Keep all sentences simple, appropriate for ${islandLevel}.

8. Distractors must come from the word list.

9. options must have exactly 4 items including the correct answer.

10. Return ONLY raw JSON — no backticks, no markdown, no extra text.`;
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
    const { messages, islandLevel, islandTopic, words, mode } = body;

    if (!islandLevel || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const wordList = words
      .slice(0, 12)
      .map((w) => `${w.hanzi} (${w.pinyin}) — ${w.english}`)
      .join(", ");

    const topic = (islandTopic || "daily life").slice(0, 120);
    const level = islandLevel.slice(0, 16);
    const exerciseMode = mode === "exercise";
    const tier = getLevelTier(level);
    const resolvedSystemPrompt = exerciseMode
      ? buildExerciseSystemPrompt(topic, level, wordList)
      : buildSystemPrompt(tier, topic, level, wordList);

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "DEEPSEEK_API_KEY not configured" },
        { status: 500 },
      );
    }

    const safeMessages = Array.isArray(messages)
      ? messages.slice(-MAX_MESSAGES).map((m) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: String(m.content ?? "").slice(0, MAX_CONTENT_LENGTH),
        }))
      : [];

    const chatMessages: IncomingMessage[] =
      safeMessages.length === 0
        ? [
            {
              role: "user",
              content: exerciseMode
                ? "Generate the exercises."
                : "Start the practice session now. Send your first message to the learner.",
            },
          ]
        : safeMessages;

    const deepseekRes = await fetch(getDeepSeekUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          { role: "system", content: resolvedSystemPrompt },
          ...chatMessages,
        ],
        temperature: exerciseMode ? 0.3 : 0.7,
        max_tokens: exerciseMode ? 2000 : 600,
      }),
    });

    if (!deepseekRes.ok) {
      const t = await deepseekRes.text();
      console.error("[learn-chat] DeepSeek error", deepseekRes.status, t.slice(0, 500));
      return NextResponse.json(
        { error: "Chat provider error" },
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
