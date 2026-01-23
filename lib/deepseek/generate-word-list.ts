/**
 * Fast word list generation for topic islands
 * Uses optimized settings for quick word-only generation
 */

export interface Word {
  hanzi: string
  pinyin: string
  english: string
}

interface WordListResponse {
  words: Word[]
}

export async function generateWordList({
  topic,
  level,
  detailedLevel,
  wordCount,
  existingWords,
}: {
  topic: string
  level: 'A2' | 'B1' | 'B2'
  detailedLevel?: string
  wordCount: number
  existingWords: string[]
}): Promise<Word[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY not configured')
  }

  if (wordCount < 1 || wordCount > 20) {
    throw new Error('wordCount must be between 1 and 20')
  }

  const existingWordsList =
    existingWords.length > 0
      ? `\n\nIMPORTANT: Do NOT include these words (already in the island): ${existingWords.join(', ')}`
      : ''

  const levelDescriptions = {
    A2: 'upper beginner (simple sentence structures, common vocabulary)',
    B1: 'intermediate (more complex structures, varied vocabulary)',
    B2: 'upper intermediate (advanced structures, nuanced vocabulary)',
  }

  const actualDetailedLevel = detailedLevel || level

  const prompt = `You are a Mandarin Chinese learning assistant. Generate a list of Chinese vocabulary words for a topic island.

Topic: ${topic}
Learner's level: ${actualDetailedLevel} (${level} band: ${levelDescriptions[level]})${existingWordsList}

Requirements:
- Generate EXACTLY ${wordCount} unique words
- Use Simplified Chinese (not Traditional)
- Use natural, high-frequency vocabulary appropriate for ${level} learners
- Do NOT use rare idioms or classical Chinese
- Provide accurate pinyin with tone marks
- Words should be relevant to the topic
- Each word must be different from the existing words listed above
- Words should be practical and useful for daily conversation

Output ONLY valid JSON (no markdown, no code blocks, no explanation). Format:

{
  "words": [
    {"hanzi": "...", "pinyin": "...", "english": "..."},
    {"hanzi": "...", "pinyin": "...", "english": "..."}
  ]
}

CRITICAL: The "words" array MUST contain EXACTLY ${wordCount} items.`

  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant that generates structured JSON data for Chinese language learning. Always respond with valid JSON only, no markdown formatting.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // Lower temperature for faster, more deterministic results
      max_tokens: 800, // Smaller token limit since we're only generating words
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `DeepSeek API error: ${response.status} ${response.statusText} - ${errorText}`
    )
  }

  const data = await response.json()
  const content = data.choices[0]?.message?.content

  if (!content) {
    throw new Error('No content in DeepSeek response')
  }

  // Parse JSON response (handle markdown code blocks if present)
  let jsonContent = content.trim()
  if (jsonContent.startsWith('```')) {
    // Remove markdown code block wrapper
    jsonContent = jsonContent.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '')
  }

  let parsed: WordListResponse
  try {
    parsed = JSON.parse(jsonContent)
  } catch (error) {
    throw new Error(
      `Failed to parse DeepSeek response as JSON: ${error}. Content: ${jsonContent.substring(0, 200)}`
    )
  }

  // Validate response structure
  if (!parsed.words || !Array.isArray(parsed.words)) {
    throw new Error('Invalid response format: missing words array')
  }

  // Validate each word
  for (const word of parsed.words) {
    if (!word.hanzi || !word.pinyin || !word.english) {
      throw new Error(`Invalid word structure: ${JSON.stringify(word)}`)
    }

    // Check for duplicates in the response
    const duplicates = parsed.words.filter((w) => w.hanzi === word.hanzi)
    if (duplicates.length > 1) {
      throw new Error(`Duplicate word in response: ${word.hanzi}`)
    }

    // Check against existing words
    if (existingWords.includes(word.hanzi)) {
      throw new Error(`Generated word already exists: ${word.hanzi}`)
    }
  }

  // Ensure we have the right count (allow slight variance but warn)
  if (parsed.words.length !== wordCount) {
    console.warn(
      `Expected ${wordCount} words but got ${parsed.words.length}. Using what we got.`
    )
  }

  return parsed.words
}

