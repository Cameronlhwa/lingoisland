/**
 * DeepSeek API integration for generating topic island vocabulary
 */

interface WordItem {
  word: {
    hanzi: string
    pinyin: string
    english: string
  }
  sentences: Array<{
    tier: 'easy' | 'same' | 'hard'
    hanzi: string
    pinyin: string
    english: string
    grammarTag?: string | null
  }>
}

interface GenerateResponse {
  items: WordItem[]
  grammarTags?: string[]
}

export async function generateIslandBatch({
  topic,
  level,
  detailedLevel,
  batchSize,
  existingWords,
  grammarTarget,
  knownWords,
}: {
  topic: string
  level: 'A2' | 'B1' | 'B2'
  detailedLevel?: string
  batchSize: number
  existingWords: string[]
  grammarTarget?: number
  knownWords?: string[]
}): Promise<GenerateResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY not configured')
  }

  if (batchSize > 5) {
    throw new Error('batchSize must be <= 5')
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
  
  // Define easy/same/hard tiers relative to the detailed level
  const easyTierMap: Record<string, string> = {
    'A2-': 'beginner / early A2',
    'A2': 'early A2',
    'A2+': 'solid A2',
    'B1-': 'strong A2 / weak B1',
    'B1': 'A2+ / weak B1',
    'B1+': 'solid B1',
    'B2-': 'strong B1',
    'B2': 'B1+',
    'B2+': 'solid B2',
  }
  
  const hardTierMap: Record<string, string> = {
    'A2-': 'A2 level',
    'A2': 'A2+ level',
    'A2+': 'early B1',
    'B1-': 'B1 level',
    'B1': 'B1+ level',
    'B1+': 'early B2',
    'B2-': 'B2 level',
    'B2': 'B2+ level',
    'B2+': 'slightly above B2 (but not academic C1)',
  }

  const easyDescription = easyTierMap[actualDetailedLevel] || `one full level easier than ${level}`
  const hardDescription = hardTierMap[actualDetailedLevel] || `slightly harder than ${level}`

  const knownWordsSection = knownWords && knownWords.length > 0
    ? `\n\nKNOWN WORDS for context (use naturally, about 2 times each across all sentences):\n${knownWords.join(', ')}\n- Only include these words where they fit naturally.\n- Do NOT force them or re-explain them; treat as familiar vocabulary.`
    : ''

  const grammarSection = grammarTarget && grammarTarget > 0
    ? `\n\nGRAMMAR FOCUS:\n- Internally choose ${grammarTarget} appropriate grammar pattern(s) for ${actualDetailedLevel} (e.g., result complements, 把-structure, passive 被).\n- For each word, AT MOST ONE sentence should strongly highlight a target pattern.\n- Other sentences should use familiar grammar so the focus stays on vocabulary.\n- In your JSON, include a root "grammarTags" array with the names of patterns you used.\n- For each sentence, include an optional "grammarTag" field (the pattern name or null).`
    : ''

  const prompt = `You are a Mandarin Chinese learning assistant. Generate Chinese vocabulary words with example sentences for a topic island.

Topic: ${topic}
Learner's chosen sub-level: ${actualDetailedLevel} (${level} band: ${levelDescriptions[level]})${existingWordsList}${knownWordsSection}${grammarSection}

For each word, provide:
1. The word itself: Simplified Chinese (hanzi), pinyin with tone marks, and English translation
2. Three example sentences showing the word in context:
   - "easy": Approximately ONE FULL LEVEL easier than ${actualDetailedLevel} (${easyDescription}). Shorter sentences, simpler grammar and vocabulary.
   - "same": EXACTLY at ${actualDetailedLevel} difficulty. This must be a perfect match for the learner's current level.
   - "hard": Only A TINY BIT harder than ${actualDetailedLevel} (${hardDescription}). May add one new grammar point or 1-2 harder words, but mostly understandable.

CRITICAL: All example sentences must be CONVERSATIONAL and CASUAL - exactly what a 20-30 year old person would say to their friend in everyday situations. Think:
- Natural, relaxed speech patterns
- Friendly, informal tone
- How people actually talk, not textbook examples
- Avoid formal or academic language
- Use contractions, casual expressions, and natural flow
- Sound like chatting with a close friend, not giving a presentation

Requirements:
- Use Simplified Chinese (not Traditional)
- Use natural, high-frequency vocabulary appropriate for A2-B2 learners
- Do NOT use rare idioms or classical Chinese
- Provide accurate pinyin with tone marks
- Each sentence should be practical and useful
- Ensure all fields are non-empty strings
- The sentences should naturally demonstrate the word's usage
- Write sentences as if texting or talking to a friend - casual, conversational, authentic

Output ONLY valid JSON (no markdown, no code blocks, no explanation). Format:

{
  "items": [
    {
      "word": {"hanzi": "...", "pinyin": "...", "english": "..."},
      "sentences": [
        {"tier": "easy", "hanzi": "...", "pinyin": "...", "english": "...", "grammarTag": null},
        {"tier": "same", "hanzi": "...", "pinyin": "...", "english": "...", "grammarTag": "把-structure"},
        {"tier": "hard", "hanzi": "...", "pinyin": "...", "english": "...", "grammarTag": null}
      ]
    }
  ],
  "grammarTags": ["把-structure", "..."]
}`

  // CRITICAL CONSTRAINTS:
  // - The "items" array MUST contain AT MOST ${batchSize} items.
  // - If you're unsure, return FEWER items, never more.
  // - Under no circumstances should the "items" array length be greater than ${batchSize}.`

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
      temperature: 0.7,
      max_tokens: 4000,
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

  let parsed: GenerateResponse
  try {
    parsed = JSON.parse(jsonContent)
  } catch (error) {
    throw new Error(
      `Failed to parse DeepSeek response as JSON: ${error}. Content: ${jsonContent.substring(0, 200)}`
    )
  }

  // Validate response structure
  if (!parsed.items || !Array.isArray(parsed.items)) {
    throw new Error('Invalid response format: missing items array')
  }

  if (parsed.items.length > batchSize) {
    // Truncate if too many
    parsed.items = parsed.items.slice(0, batchSize)
  }

  // Validate each item
  for (const item of parsed.items) {
    if (
      !item.word?.hanzi ||
      !item.word?.pinyin ||
      !item.word?.english ||
      !item.sentences ||
      !Array.isArray(item.sentences)
    ) {
      throw new Error(`Invalid item structure: ${JSON.stringify(item)}`)
    }

    // Validate sentences
    const tiers = item.sentences.map((s) => s.tier).sort()
    const expectedTiers = ['easy', 'hard', 'same'].sort()
    if (JSON.stringify(tiers) !== JSON.stringify(expectedTiers)) {
      throw new Error(
        `Invalid sentence tiers. Expected easy/same/hard, got: ${tiers.join(', ')}`
      )
    }

    // Validate all fields are non-empty
    for (const sentence of item.sentences) {
      if (!sentence.hanzi || !sentence.pinyin || !sentence.english) {
        throw new Error(`Missing fields in sentence: ${JSON.stringify(sentence)}`)
      }
    }
  }

  return parsed
}

