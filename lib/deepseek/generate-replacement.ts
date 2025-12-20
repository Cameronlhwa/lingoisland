/**
 * Generate a single replacement word (cheaper/faster model)
 * Checks database before generating sentences
 */

interface WordOnly {
  hanzi: string
  pinyin: string
  english: string
}

interface Sentence {
  tier: 'easy' | 'same' | 'hard'
  hanzi: string
  pinyin: string
  english: string
}

export async function generateReplacementWord({
  topic,
  level,
  existingWords,
  maxRetries = 3,
}: {
  topic: string
  level: 'A2' | 'B1' | 'B2'
  existingWords: string[]
  maxRetries?: number
}): Promise<{ word: WordOnly; sentences: Sentence[] } | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY

  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY not configured')
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

  // First, generate just the word
  const wordPrompt = `Generate ONE Chinese vocabulary word for the topic "${topic}" at ${level} level (${levelDescriptions[level]})${existingWordsList}

Requirements:
- Use Simplified Chinese (not Traditional)
- Use natural, high-frequency vocabulary appropriate for A2-B2 learners
- Do NOT use rare idioms or classical Chinese
- Provide accurate pinyin with tone marks
- The word must be different from: ${existingWords.join(', ') || 'none'}

Output ONLY valid JSON (no markdown, no code blocks):
{
  "word": {"hanzi": "...", "pinyin": "...", "english": "..."}
}`

  let attempts = 0
  let wordData: WordOnly | null = null

  // Try to generate a unique word
  while (attempts < maxRetries && !wordData) {
    attempts++
    try {
      const wordResponse = await fetch(
        'https://api.deepseek.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat', // Using same model but with lower temperature for speed
            messages: [
              {
                role: 'system',
                content:
                  'You are a helpful assistant. Always respond with valid JSON only, no markdown formatting.',
              },
              {
                role: 'user',
                content: wordPrompt,
              },
            ],
            temperature: 0.5, // Lower temperature for faster, more deterministic results
            max_tokens: 200, // Much smaller since we're only generating one word
          }),
        }
      )

      if (!wordResponse.ok) {
        throw new Error(`Word generation failed: ${wordResponse.status}`)
      }

      const wordResult = await wordResponse.json()
      const wordContent = wordResult.choices[0]?.message?.content

      if (!wordContent) {
        throw new Error('No content in word generation response')
      }

      // Parse word JSON
      let wordJson = wordContent.trim()
      if (wordJson.startsWith('```')) {
        wordJson = wordJson.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '')
      }

      const parsedWord = JSON.parse(wordJson)

      if (!parsedWord.word?.hanzi || !parsedWord.word?.pinyin || !parsedWord.word?.english) {
        throw new Error('Invalid word structure')
      }

      // Check if word already exists
      if (existingWords.includes(parsedWord.word.hanzi)) {
        // Retry with updated list
        continue
      }

      wordData = parsedWord.word
    } catch (error) {
      console.error(`Word generation attempt ${attempts} failed:`, error)
      if (attempts >= maxRetries) {
        throw error
      }
    }
  }

  if (!wordData) {
    throw new Error('Failed to generate a unique word after retries')
  }

  // Now generate sentences for this word
  const sentencePrompt = `Generate 3 example sentences for the Chinese word: ${wordData.hanzi} (${wordData.pinyin}, meaning: ${wordData.english})

Context: Topic "${topic}", Learner level: ${level} (${levelDescriptions[level]})

Generate three sentences:
- "easy": A sentence slightly easier than ${level} level
- "same": A sentence at ${level} level  
- "hard": A sentence slightly harder than ${level} level

CRITICAL: All sentences must be CONVERSATIONAL and CASUAL - exactly what a 20-30 year old person would say to their friend.

Requirements:
- Use Simplified Chinese
- Provide accurate pinyin with tone marks
- Natural, conversational tone
- Each sentence should naturally demonstrate the word's usage

Output ONLY valid JSON:
{
  "sentences": [
    {"tier": "easy", "hanzi": "...", "pinyin": "...", "english": "..."},
    {"tier": "same", "hanzi": "...", "pinyin": "...", "english": "..."},
    {"tier": "hard", "hanzi": "...", "pinyin": "...", "english": "..."}
  ]
}`

  try {
    const sentenceResponse = await fetch(
      'https://api.deepseek.com/v1/chat/completions',
      {
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
                'You are a helpful assistant. Always respond with valid JSON only, no markdown formatting.',
            },
            {
              role: 'user',
              content: sentencePrompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
      }
    )

    if (!sentenceResponse.ok) {
      throw new Error(`Sentence generation failed: ${sentenceResponse.status}`)
    }

    const sentenceResult = await sentenceResponse.json()
    const sentenceContent = sentenceResult.choices[0]?.message?.content

    if (!sentenceContent) {
      throw new Error('No content in sentence generation response')
    }

    // Parse sentence JSON
    let sentenceJson = sentenceContent.trim()
    if (sentenceJson.startsWith('```')) {
      sentenceJson = sentenceJson.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '')
    }

    const parsedSentences = JSON.parse(sentenceJson)

    if (!parsedSentences.sentences || !Array.isArray(parsedSentences.sentences)) {
      throw new Error('Invalid sentence structure')
    }

    // Validate sentences
    const tiers = parsedSentences.sentences.map((s: any) => s.tier).sort()
    const expectedTiers = ['easy', 'hard', 'same'].sort()
    if (JSON.stringify(tiers) !== JSON.stringify(expectedTiers)) {
      throw new Error(`Invalid sentence tiers: ${tiers.join(', ')}`)
    }

    // Validate all fields
    for (const sentence of parsedSentences.sentences) {
      if (!sentence.hanzi || !sentence.pinyin || !sentence.english) {
        throw new Error('Missing fields in sentence')
      }
    }

    return {
      word: wordData,
      sentences: parsedSentences.sentences as Sentence[],
    }
  } catch (error) {
    console.error('Error generating sentences:', error)
    throw error
  }
}

