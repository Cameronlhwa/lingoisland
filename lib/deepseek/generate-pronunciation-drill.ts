/**
 * Generates word+sentence pronunciation drill items for Flow 2's daily
 * practice loop. Each item pairs a target word with one natural sentence
 * containing it, so the learner practices the word first, then the sentence.
 */

import { withSurfaceDrillPinyin } from "@/lib/pronunciation/surfacePinyin";
import type { DrillSlot, RecentWord } from "@/lib/pronunciation/sessionPlan";

export interface DrillItem {
  itemId?: string;
  wordHanzi: string;
  wordPinyin: string;
  wordEnglish: string;
  sentenceHanzi: string;
  sentencePinyin: string;
  sentenceEnglish: string;
  /** Set only on weak-sound focus items — the exact character (and its tone)
   *  this item was generated to reinforce, distinct from wordHanzi which may
   *  be a longer word containing it. Drives the practice loop's tip screen
   *  and forces the isolate-syllable drill regardless of this attempt's score. */
  focusSyllable?: string;
  focusPinyin?: string | null;
  focusTone?: number | null;
}

interface DrillResponse {
  items: DrillItem[];
}

function stripCodeFence(content: string) {
  let jsonContent = content.trim();
  if (jsonContent.startsWith("```")) {
    jsonContent = jsonContent.replace(/^```(?:json)?\n/, "").replace(/\n```$/, "");
  }
  return jsonContent;
}

const HSK_GUIDANCE: Record<string, string> = {
  "1": "very simple, high-frequency words and short sentences (4-8 characters)",
  "2": "simple everyday words and short sentences (6-10 characters)",
  "3": "common everyday vocabulary, natural conversational sentences (8-14 characters)",
  "4": "broader everyday + some abstract vocabulary, natural sentences (10-18 characters)",
  "5": "varied vocabulary including some idiomatic expressions, natural sentences (12-22 characters)",
  "6": "sophisticated vocabulary and natural, nuanced sentences (14-26 characters)",
  "7-9": "advanced, near-native vocabulary and natural, nuanced sentences",
};

function guidanceFor(hskLevel: string): string {
  return HSK_GUIDANCE[hskLevel] || HSK_GUIDANCE["3"];
}

function describeSlot(slot: DrillSlot, index: number, topics: string): string {
  const n = index + 1;
  if (slot.kind === "character") {
    const pinyin = slot.sound.pinyin ? ` (${slot.sound.pinyin})` : "";
    return `Item ${n}: TARGET CHARACTER ${slot.sound.syllable}${pinyin}. The word MUST contain this exact character. Prefer a word from the recent-vocabulary list if one contains it; otherwise invent a common word at this level. Sentence about: ${topics}.`;
  }
  if (slot.kind === "tag") {
    return `Item ${n}: TARGET SOUND PATTERN "${slot.label}". ${slot.hint} Prefer a recent-vocabulary word if one fits this pattern; otherwise invent a word at this level. Sentence about: ${topics}.`;
  }
  return `Item ${n}: MIXED review — vary tones/initials. Prefer a recent-vocabulary word if possible. Sentence about: ${topics}.`;
}

export async function generatePronunciationDrill({
  hskLevel,
  easierHskLevel,
  topics,
  count = 5,
  recentWords = [],
  slots,
}: {
  hskLevel: string;
  easierHskLevel?: string;
  topics: string[];
  count?: number;
  recentWords?: RecentWord[];
  slots?: DrillSlot[];
}): Promise<DrillItem[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }

  const topicText = topics.length > 0 ? topics.join(", ") : "everyday life";
  const sentenceLevel = easierHskLevel && easierHskLevel !== hskLevel ? easierHskLevel : hskLevel;
  const guidance = guidanceFor(sentenceLevel);
  const plannedSlots = slots && slots.length > 0 ? slots.slice(0, count) : null;
  const itemCount = plannedSlots?.length ?? count;

  const recentBlock =
    recentWords.length > 0
      ? `Recently learned words (prefer these when they contain the target sound/character; otherwise invent a new word at HSK ${hskLevel}):\n${recentWords
          .map((w) => `- ${w.hanzi} (${w.pinyin}) — ${w.english}`)
          .join("\n")}`
      : "No recently learned words available — invent appropriate vocabulary.";

  const slotBlock = plannedSlots
    ? `Generate exactly ${itemCount} items, one per line below. Do not skip a slot.\n${plannedSlots
        .map((slot, i) => describeSlot(slot, i, topicText))
        .join("\n")}`
    : `Generate ${itemCount} short practice items. Vary the tones and initial sounds across the words so the set is useful for pronunciation practice (don't repeat the same tone pattern every time).`;

  const prompt = `You are a Mandarin Chinese pronunciation coach. Generate ${itemCount} short practice items.

Learner vocabulary level: HSK ${hskLevel}
Sentence complexity (keep at or slightly below their level): HSK ${sentenceLevel} — ${guidance}
Topics the learner is interested in: ${topicText}

${recentBlock}

${slotBlock}

For each item, provide:
1. One target word (Simplified Chinese, pinyin with tone marks, English translation)
2. One natural sentence that contains that exact word

Requirements:
- Use Simplified Chinese only
- Sentences must be short, conversational, and no harder than HSK ${sentenceLevel} — never above the learner's level
- Prefer recently learned words when they fit the slot's target
- The sentence must literally contain the word's hanzi as a substring
- All fields must be non-empty strings

Output ONLY valid JSON (no markdown, no code fences). Format:
{
  "items": [
    {"wordHanzi": "...", "wordPinyin": "...", "wordEnglish": "...", "sentenceHanzi": "...", "sentencePinyin": "...", "sentenceEnglish": "..."}
  ]
}`;

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that generates structured JSON data for Chinese pronunciation practice. Always respond with valid JSON only, no markdown formatting.",
        },
        { role: "user", content: prompt },
      ],
      // These drills are structured generation, not a reasoning task. With
      // DeepSeek V4, thinking can consume the completion before JSON is sent.
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in DeepSeek response");
  }

  let parsed: DrillResponse;
  try {
    parsed = JSON.parse(stripCodeFence(content));
  } catch (error) {
    throw new Error(`Failed to parse DeepSeek response as JSON: ${error}`);
  }

  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error("Invalid response format: missing items array");
  }

  const items: DrillItem[] = [];
  const limit = plannedSlots?.length ?? Math.min(parsed.items.length, itemCount);
  for (let i = 0; i < limit; i++) {
    const raw = parsed.items[i];
    if (
      !raw?.wordHanzi ||
      !raw.wordPinyin ||
      !raw.wordEnglish ||
      !raw.sentenceHanzi ||
      !raw.sentencePinyin ||
      !raw.sentenceEnglish ||
      !raw.sentenceHanzi.includes(raw.wordHanzi)
    ) {
      continue;
    }
    const slot = plannedSlots?.[i];
    const item: DrillItem = {
      wordHanzi: raw.wordHanzi,
      wordPinyin: raw.wordPinyin,
      wordEnglish: raw.wordEnglish,
      sentenceHanzi: raw.sentenceHanzi,
      sentencePinyin: raw.sentencePinyin,
      sentenceEnglish: raw.sentenceEnglish,
    };
    if (slot?.kind === "character") {
      item.focusSyllable = slot.sound.syllable;
      item.focusPinyin = slot.sound.pinyin;
      item.focusTone = slot.sound.targetTone;
    }
    items.push(item);
  }

  if (items.length === 0) {
    throw new Error("No valid drill items in DeepSeek response");
  }

  // Show spoken/surface tones (sandhi) so pinyin matches TTS + scoring.
  return items.map(withSurfaceDrillPinyin);
}

export interface DrillWord {
  hanzi: string;
  pinyin: string;
  english: string;
}

/**
 * Generates one natural sentence per given word for the journey's tone_practice
 * checkpoint. Unlike generatePronunciationDrill, the words are fixed (the island's
 * own island_words) — DeepSeek only supplies a sentence for each, so the drill
 * reinforces the exact vocabulary the learner just studied.
 */
export async function generatePronunciationSentencesForWords({
  words,
  level,
}: {
  words: DrillWord[];
  level: string;
}): Promise<DrillItem[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }
  if (words.length === 0) {
    throw new Error("No words provided");
  }

  const wordList = words
    .map((w, i) => `${i + 1}. ${w.hanzi} (${w.pinyin}) — ${w.english}`)
    .join("\n");

  const prompt = `You are a Mandarin Chinese pronunciation coach. A learner at CEFR level ${level} just finished studying these exact words:
${wordList}

For each word, write one natural, conversational sentence that contains that exact word's hanzi as a substring, appropriate for a ${level} learner.

Requirements:
- Use Simplified Chinese only
- The sentence must literally contain the word's hanzi as a substring
- Sentences should sound natural and conversational, not textbook-stiff
- All fields must be non-empty strings

Output ONLY valid JSON (no markdown, no code fences). Format:
{
  "items": [
    {"sentenceHanzi": "...", "sentencePinyin": "...", "sentenceEnglish": "..."}
  ]
}
Return exactly ${words.length} items, in the same order as the word list above.`;

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that generates structured JSON data for Chinese pronunciation practice. Always respond with valid JSON only, no markdown formatting.",
        },
        { role: "user", content: prompt },
      ],
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in DeepSeek response");
  }

  let parsed: { items: Array<{ sentenceHanzi: string; sentencePinyin: string; sentenceEnglish: string }> };
  try {
    parsed = JSON.parse(stripCodeFence(content));
  } catch (error) {
    throw new Error(`Failed to parse DeepSeek response as JSON: ${error}`);
  }

  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error("Invalid response format: missing items array");
  }

  const items: DrillItem[] = [];
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const sentence = parsed.items[i];
    if (
      !sentence?.sentenceHanzi ||
      !sentence?.sentencePinyin ||
      !sentence?.sentenceEnglish ||
      !sentence.sentenceHanzi.includes(word.hanzi)
    ) {
      continue;
    }
    items.push({
      wordHanzi: word.hanzi,
      wordPinyin: word.pinyin,
      wordEnglish: word.english,
      sentenceHanzi: sentence.sentenceHanzi,
      sentencePinyin: sentence.sentencePinyin,
      sentenceEnglish: sentence.sentenceEnglish,
    });
  }

  if (items.length === 0) {
    throw new Error("No valid drill items generated");
  }

  return items.map(withSurfaceDrillPinyin);
}

export interface WeakSound {
  syllable: string;
  pinyin: string | null;
  targetTone: number | null;
}

/**
 * Generates a word+sentence drill targeting the learner's specific weak
 * characters (aggregated from recent attempts into pronunciation_profiles.
 * weak_sounds), instead of picking vocabulary freely from a topic.
 */
export async function generatePronunciationDrillForWeakSounds({
  weakSounds,
  hskLevel,
}: {
  weakSounds: WeakSound[];
  hskLevel: string;
}): Promise<DrillItem[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }
  if (weakSounds.length === 0) {
    throw new Error("No weak sounds provided");
  }

  const guidance = guidanceFor(hskLevel);
  const soundList = weakSounds
    .map((s, i) => `${i + 1}. ${s.syllable}${s.pinyin ? ` (${s.pinyin})` : ""}`)
    .join("\n");

  const prompt = `You are a Mandarin Chinese pronunciation coach targeting a learner's specific trouble sounds, at HSK ${hskLevel}.

Trouble characters, ranked by how often the learner has missed them in recent practice:
${soundList}

For each character, choose ONE common word (the character itself, or a natural 2-character word containing it) appropriate for this level, then write one natural sentence containing that word.

Vocabulary/sentence guidance for this level: ${guidance}

Requirements:
- Use Simplified Chinese only
- Each word must literally contain that trouble character as a substring
- The sentence must literally contain the word's hanzi as a substring
- Sentences should sound natural and conversational, not textbook-stiff
- All fields must be non-empty strings

Output ONLY valid JSON (no markdown, no code fences). Format:
{
  "items": [
    {"wordHanzi": "...", "wordPinyin": "...", "wordEnglish": "...", "sentenceHanzi": "...", "sentencePinyin": "...", "sentenceEnglish": "..."}
  ]
}
Return exactly ${weakSounds.length} items, in the same order as the list above.`;

  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-v4-flash",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that generates structured JSON data for Chinese pronunciation practice. Always respond with valid JSON only, no markdown formatting.",
        },
        { role: "user", content: prompt },
      ],
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("No content in DeepSeek response");
  }

  let parsed: DrillResponse;
  try {
    parsed = JSON.parse(stripCodeFence(content));
  } catch (error) {
    throw new Error(`Failed to parse DeepSeek response as JSON: ${error}`);
  }

  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error("Invalid response format: missing items array");
  }

  // Pair each raw item with its weakSounds[i] before filtering — a dropped
  // invalid item must not shift later items out of alignment with the sound
  // they were actually generated for.
  const items: DrillItem[] = [];
  for (let i = 0; i < weakSounds.length; i++) {
    const raw = parsed.items[i];
    const target = weakSounds[i];
    if (
      !raw?.wordHanzi ||
      !raw.wordPinyin ||
      !raw.wordEnglish ||
      !raw.sentenceHanzi ||
      !raw.sentencePinyin ||
      !raw.sentenceEnglish ||
      !raw.sentenceHanzi.includes(raw.wordHanzi)
    ) {
      continue;
    }
    items.push({
      ...raw,
      focusSyllable: target.syllable,
      focusPinyin: target.pinyin,
      focusTone: target.targetTone,
    });
  }

  if (items.length === 0) {
    throw new Error("No valid drill items in DeepSeek response");
  }

  return items.map(withSurfaceDrillPinyin);
}
