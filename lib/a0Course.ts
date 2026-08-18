import type { SupabaseClient } from "@supabase/supabase-js";
import type { JourneyPlan } from "@/lib/deepseek/generate-journey";

/**
 * Fixed A0 onboarding course — stored in backend code (not DeepSeek, not
 * a0_course_* DB tables). Seeded into the user's island_words / island_sentences
 * once at start-island so the learn sequence uses the normal schema with zero
 * generation latency or API cost.
 *
 * island_sentences requires word_id + unique(word_id, tier). Each course
 * sentence is attached as tier "easy" to the word(s) it teaches:
 *   你好!              → 你好
 *   我叫[Name]。       → 我, 叫
 *   你叫什么名字?      → 什么, 名字
 *
 * Note: sentence 2 keeps the literal "[Name]" placeholder.
 */

export function isA0Level(level: string | null | undefined): boolean {
  return (level ?? "").trim().toUpperCase().startsWith("A0");
}

export const A0_COURSE_TOPIC = "Introducing Yourself";

/** Canonical A0 island-1 vocabulary — source of truth in code. */
export const A0_COURSE_WORDS = [
  { word_order: 1, hanzi: "你好", pinyin: "nǐ hǎo", english: "hello" },
  { word_order: 2, hanzi: "我", pinyin: "wǒ", english: "I, me" },
  { word_order: 3, hanzi: "叫", pinyin: "jiào", english: "to be called" },
  { word_order: 4, hanzi: "什么", pinyin: "shénme", english: "what" },
  { word_order: 5, hanzi: "名字", pinyin: "míngzi", english: "name" },
] as const;

/** Canonical A0 example sentences — source of truth in code. */
export const A0_COURSE_SENTENCES = [
  {
    sentence_order: 1,
    zh: "你好!",
    pinyin: "Nǐ hǎo!",
    english: "Hello!",
  },
  {
    sentence_order: 2,
    zh: "我叫[Name]。",
    pinyin: "Wǒ jiào [Name].",
    english: "My name is [Name].",
  },
  {
    sentence_order: 3,
    zh: "你叫什么名字?",
    pinyin: "Nǐ jiào shénme míngzi?",
    english: "What's your name?",
  },
] as const;

const WORD_TO_SENTENCE_ORDER: Record<string, number> = {
  你好: 1,
  我: 2,
  叫: 2,
  什么: 3,
  名字: 3,
};

/**
 * Fixed post-onboarding journey skeleton for A0 — no DeepSeek call.
 * Island 1 matches the mini-course; islands 2–5 unlock after paywall.
 */
export function getFixedA0JourneyPlan(topic = A0_COURSE_TOPIC): JourneyPlan {
  return {
    journeyTitle: topic || A0_COURSE_TOPIC,
    islands: [
      {
        position: 1,
        topic: "Greetings & Introductions",
        wordCount: 5,
        zh: "问候介绍",
      },
      {
        position: 2,
        topic: "Talking About Yourself",
        wordCount: 10,
        zh: "自我介绍",
      },
      {
        position: 3,
        topic: "Family & Friends",
        wordCount: 10,
        zh: "家人朋友",
      },
      {
        position: 4,
        topic: "Daily Life Basics",
        wordCount: 10,
        zh: "日常生活",
      },
      {
        position: 5,
        topic: "Simple Conversations",
        wordCount: 10,
        zh: "简单对话",
      },
    ],
    stories: [
      {
        afterIsland: 2,
        title: "Meeting Someone New",
        hint: "Uses greetings and self-introductions from islands 1–2",
      },
      {
        afterIsland: 5,
        title: "Your First Real Chat",
        hint: "Reviews words from your Introducing Yourself journey",
      },
    ],
  };
}

export async function seedA0IslandFromCourse(
  supabase: SupabaseClient,
  {
    islandId,
    userId,
  }: {
    islandId: string;
    userId: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sentenceByOrder = new Map<number, (typeof A0_COURSE_SENTENCES)[number]>(
    A0_COURSE_SENTENCES.map((s) => [s.sentence_order as number, s]),
  );

  const wordRows = A0_COURSE_WORDS.map((w) => ({
    island_id: islandId,
    user_id: userId,
    hanzi: w.hanzi,
    pinyin: w.pinyin,
    english: w.english,
    difficulty_tag: "core",
    position: w.word_order,
  }));

  const { data: insertedWords, error: insertWordsErr } = await supabase
    .from("island_words")
    .insert(wordRows)
    .select("id, hanzi");

  if (insertWordsErr || !insertedWords?.length) {
    return {
      ok: false,
      error: insertWordsErr?.message || "Failed to insert A0 island words",
    };
  }

  const sentenceRows: Array<{
    island_id: string;
    word_id: string;
    user_id: string;
    tier: string;
    hanzi: string;
    pinyin: string;
    english: string;
  }> = [];

  for (const w of insertedWords) {
    const order = WORD_TO_SENTENCE_ORDER[w.hanzi];
    const courseSentence = order != null ? sentenceByOrder.get(order) : null;
    if (!courseSentence) continue;
    sentenceRows.push({
      island_id: islandId,
      word_id: w.id,
      user_id: userId,
      tier: "easy",
      hanzi: courseSentence.zh,
      pinyin: courseSentence.pinyin,
      english: courseSentence.english,
    });
  }

  if (sentenceRows.length > 0) {
    const { error: insertSentErr } = await supabase
      .from("island_sentences")
      .insert(sentenceRows);

    if (insertSentErr) {
      return {
        ok: false,
        error: insertSentErr.message || "Failed to insert A0 island sentences",
      };
    }
  }

  const wordCount = insertedWords.length;
  const sentenceCount = sentenceRows.length;

  const { error: updateErr } = await supabase
    .from("topic_islands")
    .update({
      status: "ready",
      words_selected: wordCount,
      sentences_generated: sentenceCount,
      sentence_attempts: sentenceCount,
      sentence_tasks: sentenceCount,
    })
    .eq("id", islandId);

  if (updateErr) {
    return {
      ok: false,
      error: updateErr.message || "Failed to mark A0 island ready",
    };
  }

  return { ok: true };
}
