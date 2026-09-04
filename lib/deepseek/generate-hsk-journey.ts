/**
 * Generates a 5-island + 2-story HSK learning path via DeepSeek, themed around
 * the user's motivation bucket and free-text personalization from the HSK
 * onboarding flow (see components/Onboarding/hsk/HskOnboardingFlow.tsx).
 *
 * Unlike the core generateJourneyPlan (lib/deepseek/generate-journey.ts), this
 * does not ask the model to invent real HSK vocabulary — real words are pulled
 * from the `hsk_words` table by the caller (app/api/hsk/journey/generate/route.ts)
 * and tagged onto islands via journey_island_hsk_words. DeepSeek only supplies
 * the theme: island topics, Chinese island names, story checkpoints, and a
 * short "framing phrase" used as the plan-reveal headline.
 *
 * TODO(cameron): the prompt below is a first pass, not tuned. Iterate on it
 * once real usage shows what themes/topics land well per motivation bucket.
 */

export type HskMotivation = 'school' | 'job' | 'heritage' | 'hobby'

export interface HskJourneyIslandPlan {
  position: number
  topic: string
  zh: string
  wordCount: number
}

export interface HskJourneyStoryPlan {
  afterIsland: 2 | 5
  title: string
  hint: string
}

/**
 * Theme-only preview of a unit that would plausibly come after this one —
 * no word list or word count, since real vocabulary only gets tagged once a
 * unit is actually generated. Shown on the plan-reveal screen as a locked
 * "coming up" row so it doesn't read as a single 45-word plan being the
 * whole journey to the target level.
 */
export interface HskJourneyUpcomingUnitPlan {
  title: string
  zh: string
}

export interface HskJourneyPlan {
  journeyTitle: string
  framingPhrase: string
  islands: HskJourneyIslandPlan[]
  stories: HskJourneyStoryPlan[]
  upcomingUnits: HskJourneyUpcomingUnitPlan[]
}

const MOTIVATION_LABEL: Record<HskMotivation, string> = {
  school: 'school / academic interests',
  job: 'work / career',
  heritage: 'family and cultural heritage',
  hobby: 'a personal hobby or interest',
}

export async function generateHskJourneyPlan({
  targetLevel,
  motivation,
  personalizationText,
}: {
  targetLevel: number
  motivation: HskMotivation
  personalizationText: string
}): Promise<HskJourneyPlan> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY not configured')
  }

  const levelLabel = targetLevel === 7 ? 'HSK 7-9' : `HSK ${targetLevel}`

  const prompt = `You are a Mandarin curriculum designer building an ${levelLabel} exam-prep learning path.

The learner's motivation bucket is: ${MOTIVATION_LABEL[motivation]}
In their own words, what they told us: "${personalizationText}"

Generate a learning journey with exactly 5 sub-topic islands and 2 story checkpoints, themed
around what the learner told us above, appropriate for ${levelLabel} vocabulary and
sentence complexity.

Also generate a short "framingPhrase": 2-4 words that name the theme of this journey (e.g.
"Career & Travel", "C-Dramas & Culture", "Family Traditions"). This becomes the headline of the
plan-reveal screen, so it must read as a punchy title, not a sentence.

Also suggest exactly 2 "upcoming units" — short theme previews for what would plausibly come
right after this journey, continuing the same real-world theme and motivation. These are previews
shown as locked/upcoming, not full islands, so no word lists needed.

RULES:
- Island 1 has 5 words.
- Islands 2-5 have 10 words each.
- Add a story checkpoint after island 2 and after island 5.
- Keep islands practical, progressively harder, and grounded in what the learner told us.
- Do not invent specific HSK vocabulary lists — real word tagging happens separately.
- The 2 upcoming units must be distinct from each other and from this journey's 5 islands.
- Each upcoming unit needs an English "title" (short label, same style as the island topics
  above, e.g. "Meetings & Presentations") AND a separate Chinese "zh" name — title must be
  English, never Chinese, exactly like how island topics vs. zh work above.

Respond in this exact JSON format:
{
  "journeyTitle": "...",
  "framingPhrase": "...",
  "islands": [
    { "position": 1, "topic": "...", "wordCount": 5, "zh": "..." },
    { "position": 2, "topic": "...", "wordCount": 10, "zh": "..." },
    { "position": 3, "topic": "...", "wordCount": 10, "zh": "..." },
    { "position": 4, "topic": "...", "wordCount": 10, "zh": "..." },
    { "position": 5, "topic": "...", "wordCount": 10, "zh": "..." }
  ],
  "stories": [
    { "afterIsland": 2, "title": "...", "hint": "Uses words from islands 1-2" },
    { "afterIsland": 5, "title": "...", "hint": "Reviews all journey words" }
  ],
  "upcomingUnits": [
    { "title": "English title, e.g. Meetings & Presentations", "zh": "Chinese name, e.g. 会议与演讲" },
    { "title": "English title", "zh": "Chinese name" }
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
            'You are a helpful assistant that outputs only valid JSON for Chinese learning curricula. No markdown fences.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
      max_tokens: 2000,
      // V4 Flash thinking is on by default and shares the max_tokens budget —
      // without disabling it, reasoning can consume the entire allotment and
      // leave message.content empty (HTTP 200, finish_reason: length).
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `DeepSeek API error: ${response.status} ${response.statusText} - ${errorText}`
    )
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    const finish = data.choices?.[0]?.finish_reason
    const reasoningLen = data.choices?.[0]?.message?.reasoning_content?.length ?? 0
    throw new Error(
      `No content in DeepSeek response (finish_reason=${finish}, reasoning_tokens≈${reasoningLen}, usage=${JSON.stringify(data.usage)})`
    )
  }

  let jsonContent = content.trim()
  if (jsonContent.startsWith('```')) {
    jsonContent = jsonContent.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '')
  }

  let parsed: HskJourneyPlan
  try {
    parsed = JSON.parse(jsonContent)
  } catch (e) {
    throw new Error(
      `Failed to parse HSK journey JSON: ${e}. Snippet: ${jsonContent.slice(0, 240)}`
    )
  }

  if (!parsed.islands || !Array.isArray(parsed.islands) || parsed.islands.length !== 5) {
    throw new Error('HSK journey must contain exactly 5 islands')
  }

  const normalizedIslands: HskJourneyIslandPlan[] = parsed.islands.map((raw: any, idx) => {
    const position = Number(raw.position ?? idx + 1)
    const topicName = String(raw.topic ?? raw.name ?? '').trim()
    const zh = String(raw.zh ?? '').trim()
    if (!topicName || !zh) {
      throw new Error(`Invalid HSK island row: ${JSON.stringify(raw)}`)
    }
    return {
      position,
      topic: topicName,
      zh,
      wordCount: position === 1 ? 5 : 10,
    }
  })

  const normalizedStories: HskJourneyStoryPlan[] = Array.isArray((parsed as any).stories)
    ? (parsed as any).stories
        .map((raw: any) => {
          const afterIsland = Number(raw.afterIsland)
          if (afterIsland !== 2 && afterIsland !== 5) return null
          const title = String(raw.title ?? '').trim()
          const hint = String(raw.hint ?? '').trim()
          if (!title || !hint) return null
          return { afterIsland: afterIsland as 2 | 5, title, hint }
        })
        .filter(Boolean) as HskJourneyStoryPlan[]
    : []

  if (normalizedStories.length < 2) {
    normalizedStories.length = 0
    normalizedStories.push(
      { afterIsland: 2, title: 'Checkpoint', hint: 'Uses words from islands 1-2' },
      { afterIsland: 5, title: 'Finale', hint: 'Reviews all journey words' }
    )
  }

  const normalizedUpcoming: HskJourneyUpcomingUnitPlan[] = Array.isArray(
    (parsed as any).upcomingUnits
  )
    ? (parsed as any).upcomingUnits
        .map((raw: any) => {
          const title = String(raw.title ?? '').trim()
          const zh = String(raw.zh ?? '').trim()
          if (!title) return null
          return { title, zh }
        })
        .filter(Boolean) as HskJourneyUpcomingUnitPlan[]
    : []

  if (normalizedUpcoming.length < 2) {
    normalizedUpcoming.length = 0
    normalizedUpcoming.push(
      { title: `More ${MOTIVATION_LABEL[motivation]} vocabulary`, zh: '' },
      { title: `More ${MOTIVATION_LABEL[motivation]} vocabulary`, zh: '' }
    )
  }

  const framingPhrase = String(parsed.framingPhrase ?? '').trim() || 'Your HSK Journey'

  return {
    journeyTitle: parsed.journeyTitle || framingPhrase,
    framingPhrase,
    islands: normalizedIslands.sort((a, b) => a.position - b.position),
    stories: normalizedStories.sort((a, b) => a.afterIsland - b.afterIsland),
    upcomingUnits: normalizedUpcoming.slice(0, 2),
  }
}
