/**
 * Generate sentences for a single word
 * Used in parallel generation flow
 */

export interface Sentence {
  tier: 'easy' | 'same' | 'hard'
  hanzi: string
  pinyin: string
  english: string
  grammarTag?: string | null
  style?: string | null
}

export interface Word {
  hanzi: string
  pinyin: string
  english: string
}

interface SentenceResponse {
  sentences: Sentence[]
  grammarTag?: string | null
}

export async function generateWordSentences({
  word,
  topic,
  level,
  detailedLevel,
  grammarTarget,
  grammarTags,
  knownWords,
  wordIndex,
  totalWords,
  styles,
  contexts,
  avoidOpeners,
  avoidPatterns,
  retryHint,
  generationConfig,
}: {
  word: Word
  topic: string
  level: 'A2' | 'B1' | 'B2'
  detailedLevel?: string
  grammarTarget?: number
  grammarTags?: string[] // Available grammar patterns to use
  knownWords?: string[]
  wordIndex?: number // Which word this is (0-based)
  totalWords?: number // Total number of words
  styles?: string[]
  contexts?: string[]
  avoidOpeners?: string[]
  avoidPatterns?: string[]
  retryHint?: string
  generationConfig?: {
    temperature?: number
    topP?: number
    frequencyPenalty?: number
    presencePenalty?: number
    maxTokens?: number
  }
}): Promise<Sentence[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY not configured')
  }

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

  const diversityPlanSection = styles && styles.length > 0
    ? `\n\nDIVERSITY PLAN:\n- Use these sentence styles: ${styles.join(', ')}\n- Use these contexts: ${contexts?.join(', ') || 'any'}\n- Ensure the three sentences do NOT share the same template or opener.\n- Mix structure: statement / question / short chat reply / complaint / suggestion / joking tone.\n- Vary length: some 6–10 chars, some 12–20+, some mini exchanges (1–2 sentences).\n- Keep it casual and native for 20s speakers.`
    : ''

  const avoidSection =
    (avoidOpeners && avoidOpeners.length > 0) || (avoidPatterns && avoidPatterns.length > 0)
      ? `\n\nAVOID REPEAT PATTERNS:\n- Avoid starting with: ${(avoidOpeners || []).join(', ') || 'none'}\n- Avoid these repeated patterns: ${(avoidPatterns || []).join(', ') || 'none'}\n- Do NOT reuse the same sentence template or opener as recent outputs.`
      : ''

  const retryHintSection = retryHint
    ? `\n\nRETRY NOTE:\n${retryHint}`
    : ''

  // Determine if this word should have a grammar pattern
  // Distribute grammar patterns across words when grammarTarget > 0
  let shouldUseGrammar = false
  let grammarPatternToUse: string | null = null

  if (grammarTarget && grammarTarget > 0 && grammarTags && grammarTags.length > 0) {
    // Distribute grammar patterns across words
    // For example, if grammarTarget=2 and totalWords=12, use grammar on words at positions 0, 6
    if (wordIndex !== undefined && totalWords !== undefined) {
      const wordsPerPattern = Math.floor(totalWords / grammarTarget)
      const patternIndex = Math.floor(wordIndex / wordsPerPattern)
      if (patternIndex < grammarTarget && patternIndex < grammarTags.length) {
        shouldUseGrammar = true
        grammarPatternToUse = grammarTags[patternIndex]
      }
    } else {
      // Fallback: use grammar on first word if we don't have position info
      shouldUseGrammar = wordIndex === 0
      grammarPatternToUse = grammarTags[0] || null
    }
  }

  const grammarSection = shouldUseGrammar && grammarPatternToUse
    ? `\n\nGRAMMAR FOCUS:\n- Use the grammar pattern "${grammarPatternToUse}" in ONE of the three sentences.\n- The sentence with this pattern should naturally demonstrate it.\n- The other two sentences should use familiar grammar so the focus stays on vocabulary.\n- Include the grammarTag field: "${grammarPatternToUse}" for the sentence using the pattern, null for others.`
    : ''

  const prompt = `You are a Mandarin Chinese learning assistant. Generate example sentences for a single vocabulary word.

Word to demonstrate: ${word.hanzi} (${word.pinyin}) - ${word.english}
Topic: ${topic}
Learner's level: ${actualDetailedLevel} (${level} band: ${levelDescriptions[level]})${knownWordsSection}${diversityPlanSection}${grammarSection}${avoidSection}${retryHintSection}

Generate THREE example sentences showing this word in context:
1. "easy": Approximately ONE FULL LEVEL easier than ${actualDetailedLevel} (${easyDescription}). Shorter sentences, simpler grammar and vocabulary.
2. "same": EXACTLY at ${actualDetailedLevel} difficulty. This must be a perfect match for the learner's current level.
3. "hard": Only A TINY BIT harder than ${actualDetailedLevel} (${hardDescription}). May add one new grammar point or 1-2 harder words, but mostly understandable.

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
- Include the target word in each sentence (hanzi must contain "${word.hanzi}")
- Use casual connectors: 其实、感觉、有点、挺、蛮、就、真的、太…了、别…了 (some, not all)
- Light slang is allowed but not forced (e.g., 离谱、emo、摆烂、上头、真香) — at most 1 slang word total per word
- Avoid textbooky patterns like “为了…所以…” and repetitive templates
- Vary sentence structures across the three outputs
- Do NOT prefix sentences with bullets, numbers, or list markers (e.g., '-', '•', '1.')

Output ONLY valid JSON (no markdown, no code blocks, no explanation). Format:

{
  "sentences": [
    {"tier": "easy", "hanzi": "...", "pinyin": "...", "english": "...", "grammarTag": null, "style": "${styles?.[0] || 'chat reply'}"},
    {"tier": "same", "hanzi": "...", "pinyin": "...", "english": "...", "grammarTag": ${shouldUseGrammar && grammarPatternToUse ? `"${grammarPatternToUse}"` : 'null'}, "style": "${styles?.[1] || 'statement'}"},
    {"tier": "hard", "hanzi": "...", "pinyin": "...", "english": "...", "grammarTag": null, "style": "${styles?.[2] || 'mini dialogue'}"}
  ]
}`

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
      temperature: generationConfig?.temperature ?? 0.9,
      top_p: generationConfig?.topP ?? 0.93,
      frequency_penalty: generationConfig?.frequencyPenalty ?? 0.5,
      presence_penalty: generationConfig?.presencePenalty ?? 0.35,
      max_tokens: generationConfig?.maxTokens ?? 2200, // Slightly higher for diversity and mini exchanges
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

  let parsed: SentenceResponse
  try {
    parsed = JSON.parse(jsonContent)
  } catch (error) {
    throw new Error(
      `Failed to parse DeepSeek response as JSON: ${error}. Content: ${jsonContent.substring(0, 200)}`
    )
  }

  // Validate response structure
  if (!parsed.sentences || !Array.isArray(parsed.sentences)) {
    throw new Error('Invalid response format: missing sentences array')
  }

  if (parsed.sentences.length !== 3) {
    throw new Error(`Expected 3 sentences, got ${parsed.sentences.length}`)
  }

  // Validate sentences
  const tiers = parsed.sentences.map((s) => s.tier).sort()
  const expectedTiers = ['easy', 'hard', 'same'].sort()
  if (JSON.stringify(tiers) !== JSON.stringify(expectedTiers)) {
    throw new Error(
      `Invalid sentence tiers. Expected easy/same/hard, got: ${tiers.join(', ')}`
    )
  }

  // Validate all fields are non-empty
  for (const sentence of parsed.sentences) {
    if (!sentence.hanzi || !sentence.pinyin || !sentence.english) {
      throw new Error(`Missing fields in sentence: ${JSON.stringify(sentence)}`)
    }
    if (!sentence.hanzi.includes(word.hanzi)) {
      throw new Error(`Sentence missing target word: ${JSON.stringify(sentence)}`)
    }
  }

  return parsed.sentences
}

