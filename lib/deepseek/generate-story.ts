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
  maxAttempts = 4,
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

CRITICAL LENGTH REQUIREMENT:
- story_zh MUST be between ${minLength}-${maxLength} Chinese characters (汉字)
- Count ONLY Chinese characters, excluding spaces and punctuation
- For ${lengthChars} target: aim for exactly ${lengthChars} characters
- Example: "今天我去了公园。" = 7 characters (今天我去了公园)
- Before responding, mentally count your story's character length!

Topic: ${topic}
Learner level: ${level}
Target words (must appear naturally in story_zh): ${targetWordList.join(", ")}${
    requestedWords.length
      ? `\nRequested words (also must appear): ${requestedWords.join(", ")}`
      : ""
  }

Story requirements:
- Write ${Math.round(lengthChars / 25)}-${Math.round(lengthChars / 20)} sentences (about 20-25 characters per sentence)
- Natural conversational Chinese a native in their 20s would say
- NOT textbook-style, NOT repetitive
- Use Simplified Chinese (简体中文)
- Include all target words naturally in the story
- Count your characters before finalizing!

Output STRICT JSON only:
{
  "title": "Short title (5-8 chars)",
  "story_zh": "Your story here (${minLength}-${maxLength} Chinese characters)",
  "story_pinyin": "Optional pinyin",
  "story_en": "Optional English translation"
}

REMEMBER: Count story_zh characters (excluding spaces/punctuation) = ${minLength} to ${maxLength}!`;

  let lastError: Error | null = null;
  let extraNote = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const extra = extraNote ? `\n\n${extraNote}` : "";

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
                "You are a helpful assistant that generates Chinese language learning stories. CRITICAL: You must count Chinese characters (汉字) in your story, excluding spaces and punctuation. Always aim for the exact target character count specified. Respond with valid JSON only, no markdown formatting.",
            },
            {
              role: "user",
              content: `${basePrompt}${extra}`,
            },
          ],
          temperature: 0.7,
          frequency_penalty: 0.5,
          presence_penalty: 0.3,
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
      if (charCount < minLength) {
        extraNote = `Previous story was too short (${charCount} characters). Please make story_zh longer with ${minLength}-${maxLength} Chinese characters. Add more details or sentences.`;
      } else {
        extraNote = `Previous story was too long (${charCount} characters). Please make story_zh shorter with ${minLength}-${maxLength} Chinese characters. Remove unnecessary details.`;
      }
      continue;
    }

    const missing = missingWords(parsed.story_zh, requiredWords);
    if (missing.length > 0) {
      lastError = new Error(
        `story_zh missing required words: ${missing.join(", ")}`
      );
      extraNote = `Important: You missed these required words: ${missing.join(", ")}. Ensure EVERY required word appears in story_zh naturally.`;
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

