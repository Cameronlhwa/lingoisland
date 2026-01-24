type StoryWord = {
  hanzi: string;
  pinyin?: string;
  english?: string;
};

type StoryResponse = {
  title: string;
  story_zh: string;
  story_en?: string | null;
  story_pinyin?: string | null;
};

function stripCodeFence(content: string) {
  let jsonContent = content.trim();
  if (jsonContent.startsWith("```")) {
    jsonContent = jsonContent
      .replace(/^```(?:json)?\n/, "")
      .replace(/\n```$/, "");
  }
  return jsonContent;
}

function countStoryChars(text: string) {
  return text.replace(/\s/g, "").length;
}

function missingWords(story: string, words: string[]) {
  return words.filter((word) => word && !story.includes(word));
}

export async function generateStory({
  topic,
  level,
  lengthChars,
  targetWords,
  requestedWords,
  maxAttempts = 2,
}: {
  topic: string;
  level: string;
  lengthChars: number;
  targetWords: StoryWord[];
  requestedWords: string[];
  maxAttempts?: number;
}): Promise<StoryResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }

  const targetWordList = targetWords.map((w) => w.hanzi).filter(Boolean);
  const requiredWords = Array.from(
    new Set([...targetWordList, ...requestedWords])
  );
  const minLength = Math.max(50, Math.round(lengthChars * 0.6));
  const maxLength = Math.min(500, Math.round(lengthChars * 1.4));

  const basePrompt = `You are a Mandarin Chinese storyteller for language learners.

Topic: ${topic}
Learner level: ${level}
Target length: ${lengthChars} Chinese characters (count characters, not tokens). Stay between ${minLength}-${maxLength} characters.
Target words (must appear in story_zh at least once): ${targetWordList.join(", ")}
Requested words (also must appear in story_zh): ${
    requestedWords.length ? requestedWords.join(", ") : "None"
  }

Story requirements:
- 5–10 sentences depending on length
- Natural Chinese a native in their 20s would say
- Conversational, not textbook, not repetitive
- Use Simplified Chinese
- Use target words naturally
- Keep story_zh between ${minLength} and ${maxLength} characters

Output STRICT JSON only with this shape:
{
  "title": "...",
  "story_zh": "...",
  "story_pinyin": "...",
  "story_en": "..."
}

Notes:
- story_pinyin and story_en can be empty strings if you cannot provide them.`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const extra =
      attempt === 1
        ? ""
        : `\n\nImportant: You missed these required words previously: ${requiredWords.join(
            ", "
          )}. Ensure every required word appears in story_zh.`;

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
              content: `${basePrompt}${extra}`,
            },
          ],
          temperature: 0.9,
          frequency_penalty: 0.6,
          presence_penalty: 0.2,
          max_tokens: 2200,
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

    let parsed: StoryResponse;
    try {
      parsed = JSON.parse(stripCodeFence(content));
    } catch (error) {
      lastError = new Error(
        `Failed to parse DeepSeek response as JSON: ${error}`
      );
      continue;
    }

    if (!parsed.title || !parsed.story_zh) {
      lastError = new Error("Invalid response format: missing title/story_zh");
      continue;
    }

    const charCount = countStoryChars(parsed.story_zh);
    if (charCount < minLength || charCount > maxLength) {
      lastError = new Error(
        `story_zh length out of bounds: ${charCount} characters`
      );
      continue;
    }

    const missing = missingWords(parsed.story_zh, requiredWords);
    if (missing.length > 0) {
      lastError = new Error(
        `story_zh missing required words: ${missing.join(", ")}`
      );
      continue;
    }

    return {
      title: parsed.title.trim(),
      story_zh: parsed.story_zh.trim(),
      story_en: parsed.story_en?.trim() || null,
      story_pinyin: parsed.story_pinyin?.trim() || null,
    };
  }

  throw lastError || new Error("Failed to generate story");
}

