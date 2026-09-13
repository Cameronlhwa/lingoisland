/**
 * Generates word+sentence pronunciation drill items for Flow 2's daily
 * practice loop. Each item pairs a target word with one natural sentence
 * containing it, so the learner practices the word first, then the sentence.
 */

export interface DrillItem {
  wordHanzi: string;
  wordPinyin: string;
  wordEnglish: string;
  sentenceHanzi: string;
  sentencePinyin: string;
  sentenceEnglish: string;
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

export async function generatePronunciationDrill({
  hskLevel,
  topics,
  customTopic,
  count = 5,
}: {
  hskLevel: string;
  topics: string[];
  customTopic?: string | null;
  count?: number;
}): Promise<DrillItem[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }

  const topicList = [...topics, ...(customTopic ? [customTopic] : [])];
  const topicText = topicList.length > 0 ? topicList.join(", ") : "everyday life";
  const guidance = HSK_GUIDANCE[hskLevel] || HSK_GUIDANCE["3"];

  const prompt = `You are a Mandarin Chinese pronunciation coach. Generate ${count} short practice items for a learner at HSK ${hskLevel}.

Topics the learner is interested in: ${topicText}
Vocabulary/sentence guidance for this level: ${guidance}

For each item, provide:
1. One target word (Simplified Chinese, pinyin with tone marks, English translation)
2. One natural sentence that contains that exact word, appropriate for the level

Requirements:
- Use Simplified Chinese only
- Vary the tones and initial sounds across the ${count} words so the set is useful for pronunciation practice (don't repeat the same tone pattern every time)
- The sentence must literally contain the word's hanzi as a substring
- Sentences should sound natural and conversational, not textbook-stiff
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
      temperature: 0.8,
      max_tokens: 2000,
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

  const items = parsed.items.filter(
    (item) =>
      item.wordHanzi &&
      item.wordPinyin &&
      item.wordEnglish &&
      item.sentenceHanzi &&
      item.sentencePinyin &&
      item.sentenceEnglish &&
      item.sentenceHanzi.includes(item.wordHanzi),
  );

  if (items.length === 0) {
    throw new Error("No valid drill items in DeepSeek response");
  }

  return items.slice(0, count);
}
