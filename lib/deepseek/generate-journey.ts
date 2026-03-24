/**
 * Generates a 5-island learning path JSON via DeepSeek (same stack as word/sentence generation).
 */

export interface JourneyIslandPlan {
  position: number
  topic: string
  wordCount: number
  zh: string
}

export interface JourneyStoryPlan {
  afterIsland: 2 | 5
  title: string
  hint: string
}

export interface JourneyPlan {
  journeyTitle: string
  islands: JourneyIslandPlan[]
  stories: JourneyStoryPlan[]
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

Generate a learning journey with exactly 5 sub-topic islands and 2 story checkpoints.

RULES:
- Island 1 has 5 words.
- Islands 2-5 have 10 words each.
- Add a story checkpoint after island 2 and after island 5.
- Keep islands practical and progressively harder.

Respond in this exact JSON format:
{
  "journeyTitle": "${topic}",
  "islands": [
    { "position": 1, "topic": "Getting Around", "wordCount": 5, "zh": "出行交通" },
    { "position": 2, "topic": "Booking a Hotel", "wordCount": 10, "zh": "预订酒店" },
    { "position": 3, "topic": "...", "wordCount": 10, "zh": "..." },
    { "position": 4, "topic": "...", "wordCount": 10, "zh": "..." },
    { "position": 5, "topic": "...", "wordCount": 10, "zh": "..." }
  ],
  "stories": [
    { "afterIsland": 2, "title": "...", "hint": "Uses words from islands 1-2" },
    { "afterIsland": 5, "title": "...", "hint": "Reviews all journey words" }
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

  const normalizedIslands: JourneyIslandPlan[] = parsed.islands.map((raw: any, idx) => {
    const position = Number(raw.position ?? raw.order ?? idx + 1)
    const topicName = String(raw.topic ?? raw.name ?? '').trim()
    const zh = String(raw.zh ?? '').trim()
    if (!topicName || !zh) {
      throw new Error(`Invalid island row: ${JSON.stringify(raw)}`)
    }
    return {
      position,
      topic: topicName,
      wordCount: position === 1 ? 5 : 10,
      zh,
    }
  })

  const normalizedStories: JourneyStoryPlan[] = Array.isArray((parsed as any).stories)
    ? (parsed as any).stories
        .map((raw: any) => {
          const afterIsland = Number(raw.afterIsland)
          if (afterIsland !== 2 && afterIsland !== 5) return null
          const title = String(raw.title ?? '').trim()
          const hint = String(raw.hint ?? '').trim()
          if (!title || !hint) return null
          return {
            afterIsland: afterIsland as 2 | 5,
            title,
            hint,
          }
        })
        .filter(Boolean) as JourneyStoryPlan[]
    : []

  if (normalizedStories.length < 2) {
    normalizedStories.length = 0
    normalizedStories.push(
      { afterIsland: 2, title: `${topic} checkpoint`, hint: 'Uses words from islands 1-2' },
      { afterIsland: 5, title: `${topic} finale`, hint: 'Reviews all journey words' }
    )
  }

  return {
    journeyTitle: parsed.journeyTitle || topic,
    islands: normalizedIslands.sort((a, b) => a.position - b.position),
    stories: normalizedStories.sort((a, b) => a.afterIsland - b.afterIsland),
  }
}
