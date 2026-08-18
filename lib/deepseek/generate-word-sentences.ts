/**
 * Generate sentences for a single word
 * Used in parallel generation flow
 */

import {
  getSentenceStyleDiversityNote,
  getSentenceStyleRequirements,
  getSentenceStyleToneBlock,
  normalizeSentenceStyle,
  type SentenceStyle,
} from '@/lib/sentenceStyle'

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
  sentenceTierMode = 'full',
  sentenceStyle = 'casual',
  generationConfig,
}: {
  word: Word
  topic: string
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
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
  /** Default: all three (easy / same / hard). easy_same: onboarding free island — approachable. */
  sentenceTierMode?: 'full' | 'easy_same'
  sentenceStyle?: SentenceStyle
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
    A1: 'beginner (very basic phrases, survival vocabulary, simple present tense)',
    A2: 'upper beginner (simple sentence structures, common everyday vocabulary)',
    B1: 'intermediate (more complex structures, varied vocabulary, can discuss familiar topics)',
    B2: 'upper intermediate (advanced structures, nuanced vocabulary, can express opinions)',
    C1: 'advanced (complex discourse, subtle meanings, idiomatic expressions, sophisticated vocabulary)',
  }

  const actualDetailedLevel = detailedLevel || level
  const style = normalizeSentenceStyle(sentenceStyle)
  const diversityNote = getSentenceStyleDiversityNote(style)

  // Define easy/same/hard tiers relative to the detailed level
  const easyTierMap: Record<string, string> = {
    'A1-': 'absolute beginner',
    'A1': 'weak A1',
    'A1+': 'solid A1',
    'A2-': 'strong A1 / weak A2',
    'A2': 'early A2',
    'A2+': 'solid A2',
    'B1-': 'strong A2 / weak B1',
    'B1': 'A2+ / weak B1',
    'B1+': 'solid B1',
    'B2-': 'strong B1',
    'B2': 'B1+',
    'B2+': 'solid B2',
    'C1-': 'strong B2',
    'C1': 'B2+',
    'C1+': 'solid C1',
  }

  const hardTierMap: Record<string, string> = {
    'A1-': 'A1 level',
    'A1': 'A1+ level',
    'A1+': 'early A2',
    'A2-': 'A2 level',
    'A2': 'A2+ level',
    'A2+': 'early B1',
    'B1-': 'B1 level',
    'B1': 'B1+ level',
    'B1+': 'early B2',
    'B2-': 'B2 level',
    'B2': 'B2+ level',
    'B2+': 'early C1',
    'C1-': 'C1 level',
    'C1': 'C1+ level',
    'C1+': 'high C1 (sophisticated, near-native expressions)',
  }

  const easyDescription = easyTierMap[actualDetailedLevel] || `one full level easier than ${level}`
  const hardDescription = hardTierMap[actualDetailedLevel] || `slightly harder than ${level}`

  const knownWordsSection = knownWords && knownWords.length > 0
    ? `\n\nKNOWN WORDS for context (use naturally, about 2 times each across all sentences):\n${knownWords.join(', ')}\n- Only include these words where they fit naturally.\n- Do NOT force them or re-explain them; treat as familiar vocabulary.`
    : ''

  const diversityPlanSection = styles && styles.length > 0
    ? sentenceTierMode === 'easy_same'
      ? `\n\nDIVERSITY PLAN:\n- Use these sentence styles: ${styles.join(', ')}\n- Use these contexts: ${contexts?.join(', ') || 'any'}\n- Ensure the two sentences do NOT share the same template or opener.\n- Mix structure: statement / question / short chat reply.\n- ${diversityNote}`
      : `\n\nDIVERSITY PLAN:\n- Use these sentence styles: ${styles.join(', ')}\n- Use these contexts: ${contexts?.join(', ') || 'any'}\n- Ensure the three sentences do NOT share the same template or opener.\n- Mix structure: statement / question / short chat reply / complaint / suggestion / joking tone.\n- Vary length: some 6–10 chars, some 12–20+, some mini exchanges (1–2 sentences).\n- ${diversityNote}`
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
    ? sentenceTierMode === 'easy_same'
      ? `\n\nGRAMMAR FOCUS:\n- Use the grammar pattern "${grammarPatternToUse}" in ONE of the two sentences.\n- Include the grammarTag field: "${grammarPatternToUse}" for that sentence, null for the other.`
      : `\n\nGRAMMAR FOCUS:\n- Use the grammar pattern "${grammarPatternToUse}" in ONE of the three sentences.\n- The sentence with this pattern should naturally demonstrate it.\n- The other two sentences should use familiar grammar so the focus stays on vocabulary.\n- Include the grammarTag field: "${grammarPatternToUse}" for the sentence using the pattern, null for others.`
    : ''

  // Level-specific guidance
  const levelGuidance = {
    A1: `\n\nSTYLE FOR A1: Very basic phrases (4-8 chars), simple present tense, concrete survival vocabulary (food, numbers, basic actions), NO slang.`,
    A2: `\n\nSTYLE FOR A2: Natural everyday Chinese, simple friendly tone, common expressions (就、也、都、很), practical for daily situations.`,
    B1: `\n\nSTYLE FOR B1: Conversational chat-with-friends tone, casual connectors (其实、感觉、有点、挺、就), authentic not textbooky (these are just recomended connectors. You can use other connectors similar in level if they fit naturally.).`,
    B2: `\n\nSTYLE FOR B2: What 20-30 year olds say to friends, casual connectors (其实、感觉、有点、挺、蛮、真的、太…了). Recommended slang examples (you can also use similar expressions not in this list): 不卷、躺平、摆烂、上头、真香. Use only when they fit naturally; do not use them all the time. If you use any, max 1 per word. Most sentences should be natural without slang.`,
    C1: `\n\nSTYLE FOR C1: Sophisticated yet natural, idioms and subtle meanings are OK, complex structures (that are still natural and conversational), native Chinese expressiveness.`,
  }

  const toneBlock = getSentenceStyleToneBlock(style, sentenceTierMode)
  const styleRequirements = getSentenceStyleRequirements(style)

  const prompt = sentenceTierMode === 'easy_same'
    ? `You are a Mandarin Chinese learning assistant. Generate example sentences for a single vocabulary word.

Word to demonstrate: ${word.hanzi} (${word.pinyin}) - ${word.english}
Topic: ${topic}
Learner's level: ${actualDetailedLevel} (${level} band: ${levelDescriptions[level]})${levelGuidance[level]}${knownWordsSection}${diversityPlanSection}${grammarSection}${avoidSection}${retryHintSection}

Generate TWO example sentences showing this word in context (no "hard" tier — keep it approachable):
1. "easy": Approximately ONE FULL LEVEL easier than ${actualDetailedLevel} (${easyDescription}). Shorter sentences, simpler grammar and vocabulary.
2. "same": EXACTLY at ${actualDetailedLevel} difficulty. This must be a perfect match for the learner's current level.

${toneBlock}

Requirements:
- Use Simplified Chinese (not Traditional)
- Use natural, high-frequency vocabulary appropriate for A2-C1 learners
- Do NOT use rare idioms or classical Chinese
- Provide accurate pinyin with tone marks
- Each sentence should be practical and useful
- Ensure all fields are non-empty strings
- The sentences should naturally demonstrate the word's usage
${styleRequirements}
- Include the target word in each sentence (hanzi must contain "${word.hanzi}")
- Avoid textbooky patterns like “为了…所以…” and repetitive templates
- Vary sentence structures across the two outputs
- Do NOT prefix sentences with bullets, numbers, or list markers (e.g., '-', '•', '1.')

Output ONLY valid JSON (no markdown, no code blocks, no explanation). Format:

{
  "sentences": [
    {"tier": "easy", "hanzi": "...", "pinyin": "...", "english": "...", "grammarTag": null, "style": "${styles?.[0] || 'chat reply'}"},
    {"tier": "same", "hanzi": "...", "pinyin": "...", "english": "...", "grammarTag": ${shouldUseGrammar && grammarPatternToUse ? `"${grammarPatternToUse}"` : 'null'}, "style": "${styles?.[1] || 'statement'}"}
  ]
}`
    : `You are a Mandarin Chinese learning assistant. Generate example sentences for a single vocabulary word.

Word to demonstrate: ${word.hanzi} (${word.pinyin}) - ${word.english}
Topic: ${topic}
Learner's level: ${actualDetailedLevel} (${level} band: ${levelDescriptions[level]})${levelGuidance[level]}${knownWordsSection}${diversityPlanSection}${grammarSection}${avoidSection}${retryHintSection}

Generate THREE example sentences showing this word in context:
1. "easy": Approximately ONE FULL LEVEL easier than ${actualDetailedLevel} (${easyDescription}). Shorter sentences, simpler grammar and vocabulary.
2. "same": EXACTLY at ${actualDetailedLevel} difficulty. This must be a perfect match for the learner's current level.
3. "hard": Only A TINY BIT harder than ${actualDetailedLevel} (${hardDescription}). May add one new grammar point or 1-2 harder words, but mostly understandable.

${toneBlock}

Requirements:
- Use Simplified Chinese (not Traditional)
- Use natural, high-frequency vocabulary appropriate for A2-C1 learners
- Do NOT use rare idioms or classical Chinese
- Provide accurate pinyin with tone marks
- Each sentence should be practical and useful
- Ensure all fields are non-empty strings
- The sentences should naturally demonstrate the word's usage
${styleRequirements}
- Include the target word in each sentence (hanzi must contain "${word.hanzi}")
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
      model: 'deepseek-v4-flash',
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
      max_tokens:
        generationConfig?.maxTokens ??
        (sentenceTierMode === 'easy_same' ? 1400 : 2200),
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

  const expectCount = sentenceTierMode === 'easy_same' ? 2 : 3
  if (parsed.sentences.length !== expectCount) {
    throw new Error(
      `Expected ${expectCount} sentences, got ${parsed.sentences.length}`
    )
  }

  const tiers = parsed.sentences.map((s) => s.tier).sort()
  const expectedTiers =
    sentenceTierMode === 'easy_same'
      ? ['easy', 'same'].sort()
      : ['easy', 'hard', 'same'].sort()
  if (JSON.stringify(tiers) !== JSON.stringify(expectedTiers)) {
    throw new Error(
      `Invalid sentence tiers. Expected ${expectedTiers.join('/')}, got: ${tiers.join(', ')}`
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

