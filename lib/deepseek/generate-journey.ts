/**
 * Generates a 5-island learning path JSON via DeepSeek (same stack as word/sentence generation).
 */

export interface JourneyIslandPlan {
  order: number
  name: string
  zh: string
  storyIdea: string
}

export interface JourneyPlan {
  journeyTitle: string
  islands: JourneyIslandPlan[]
}

export async function generateJourneyPlan({
  topic,
  why,
  level,
}: {
  topic: string
  why: string
  level: string
}): Promise<JourneyPlan> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY not configured')
  }

  const prompt = `You are a Mandarin vocabulary curriculum designer for learners at CEFR level ${level} (A1–C1).

The user wants to learn vocabulary about: "${topic}"
Their reason for learning: "${why}"

Generate a learning journey with exactly 5 sub-topic islands. Each island should:
- Be a specific, practical sub-topic of "${topic}"
- Have a Chinese title (2–4 characters)
- Have a short one-sentence story idea in English (max 12 words)
- Feel like a natural progression (easiest/most fundamental first)

Respond in this exact JSON format:
{
  "journeyTitle": "${topic}",
  "islands": [
    { "order": 1, "name": "Getting Around", "zh": "出行交通", "storyIdea": "Taking the Beijing subway for the first time" },
    { "order": 2, "name": "Booking a Hotel", "zh": "预订酒店", "storyIdea": "Checking into a hostel in Shanghai" },
    { "order": 3, "name": "...", "zh": "...", "storyIdea": "..." },
    { "order": 4, "name": "...", "zh": "...", "storyIdea": "..." },
    { "order": 5, "name": "...", "zh": "...", "storyIdea": "..." }
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
            'You are a helpful assistant that outputs only valid JSON for Chinese learning curricula. No markdown fences.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.35,
      max_tokens: 2000,
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

  let jsonContent = content.trim()
  if (jsonContent.startsWith('```')) {
    jsonContent = jsonContent.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '')
  }

  let parsed: JourneyPlan
  try {
    parsed = JSON.parse(jsonContent)
  } catch (e) {
    throw new Error(
      `Failed to parse journey JSON: ${e}. Snippet: ${jsonContent.slice(0, 240)}`
    )
  }

  if (!parsed.islands || !Array.isArray(parsed.islands) || parsed.islands.length !== 5) {
    throw new Error('Journey must contain exactly 5 islands')
  }

  for (const island of parsed.islands) {
    if (!island.name || !island.zh || !island.storyIdea) {
      throw new Error(`Invalid island row: ${JSON.stringify(island)}`)
    }
  }

  return parsed
}
