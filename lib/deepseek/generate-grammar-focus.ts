/**
 * Generate grammar focus points with warmup and target-level examples
 * Designed for variety, topic-relevance, and clean UI display
 */

export interface GrammarExample {
  tier: 'warmup' | 'target'
  hanzi: string
  pinyin: string
  english: string
}

export interface GrammarPoint {
  hanzi: string
  pinyin: string
  english: string
  pattern: string // Very short pattern description
  whenToUse?: string // Optional 1-line explanation
  examples: [GrammarExample, GrammarExample] // Exactly 2: warmup + target
}

export interface GrammarFocusResult {
  points: GrammarPoint[]
}

/**
 * Seed examples to calibrate level appropriateness
 * These are NOT mandatory picks - just for guidance
 * Extended lists to encourage variety
 */
const LEVEL_SEEDS = {
  A1: [
    '是…的 (basic identity)',
    '有/没有 (have/not have)',
    '在 + location',
    '想要 (want)',
    '这个/那个 (this/that)',
    '多少 (how much/many)',
    '要/想 (want to)',
    '会 (can/able)',
    '很 + adj (very)',
    '吗 (question)',
  ],
  A2: [
    '了 (completed action)',
    '正在 (ongoing)',
    '先…再… (sequence)',
    '因为…所以… (because)',
    '可以/应该 (can/should)',
    '比较 (comparison)',
    '会…了 (learned)',
    '过 (experience)',
    '得 (complement)',
    '着 (continuous state)',
    '从…到… (from to)',
    '对…感兴趣 (interested in)',
  ],
  B1: [
    '虽然…但是… (although)',
    '如果…就… (if then)',
    '既然…就… (since)',
    '才 vs 就 (timing)',
    '越…越… (more more)',
    '连…都… (even)',
    '对…来说 (for)',
    '把 + result (e.g. 弄丢了)',
    '除了…以外 (except)',
    '本来…结果… (originally)',
    '一边…一边… (while)',
    '不但…而且… (not only)',
    '无论…都… (no matter)',
    '只要…就… (as long as)',
  ],
  B2: [
    '不仅…而且… (not only)',
    '不是…而是… (not but)',
    '即使…也… (even if)',
    '以便… (in order to)',
    '反而 (on contrary)',
    '结果/导致 (result)',
    '据说/看来 (reportedly)',
    '早知道…就… (if had known)',
    '以…为… (take as)',
    '难怪 (no wonder)',
    '原来 (turns out)',
    '毕竟 (after all)',
    '总之 (in short)',
    '尽管…还是… (despite)',
  ],
  C1: [
    '与其…不如… (rather than)',
    '一方面…另一方面… (on one hand)',
    '值得 + V (worth)',
    '宁可…也不… (would rather)',
    '无论…都… (no matter)',
    '归根到底 (in final analysis)',
    '从某种程度上说 (to some extent)',
    '对此…的看法 (view on this)',
    '就…而言 (speaking of)',
    '换句话说 (in other words)',
    '说到底 (basically)',
    '综上所述 (in summary)',
  ],
}

export async function generateGrammarFocus({
  topic,
  level,
  detailedLevel,
  grammarCount,
  varietyHint,
  recentPatterns = [],
}: {
  topic: string
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1'
  detailedLevel?: string
  grammarCount: number
  varietyHint?: string | number
  recentPatterns?: string[]
}): Promise<GrammarFocusResult> {
  if (grammarCount === 0) {
    return { points: [] }
  }

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY not configured')
  }

  const actualLevel = detailedLevel || level
  const seeds = LEVEL_SEEDS[level] || LEVEL_SEEDS.B1
  const variety = varietyHint ?? Date.now()
  
  // Generate a random seed for additional variety
  const randomSeed = Math.floor(Math.random() * 10000)
  
  // Build recent patterns context
  const recentPatternsContext = recentPatterns.length > 0
    ? `\n\nRECENTLY LEARNED (try to avoid these if possible):\n${recentPatterns.map(p => `- ${p}`).join('\n')}\n\nThe user has recently learned these patterns. While you can use them if they're truly the best fit for "${topic}", prefer selecting different patterns to provide fresh learning experiences.`
    : ''

  const prompt = `You are a Chinese language learning expert. Generate EXACTLY ${grammarCount} grammar point${grammarCount > 1 ? 's' : ''} for learning to talk about "${topic}" at ${actualLevel} level.

RANDOMIZATION SEED: ${variety}-${randomSeed}
Use this seed to introduce natural variation in your selections. Each request should feel fresh and different.${recentPatternsContext}

SELECTION RULES:
1. Choose grammar that is:
   - Common and actually used in real Chinese (not obscure textbook-only patterns)
   - Relevant to the topic "${topic}"
   - Appropriate for ${actualLevel} level
   - High-frequency in spoken/written Mandarin

2. At least one grammar point should truly match the target level (especially B1+).
   - Don't always pick easy patterns; challenge the learner appropriately.

3. Make choices TOPIC-AWARE:
   - Think about what grammar naturally comes up when discussing "${topic}"
   - Example: "Going to pharmacy/hospital" → timing expressions, result patterns, decision-making structures
   - Example: "Complaining" → emphasis patterns, expectation vs reality, rhetorical questions

4. VARIETY AND CREATIVITY:
   - You have complete freedom to select ANY level-appropriate grammar
   - Think broadly about the Chinese language - not just textbook patterns
   - Mix well-known structures with less commonly taught but equally useful ones
   - Consider both formal and colloquial patterns if appropriate

5. If you can't find ${grammarCount} truly topic-relevant patterns, return FEWER rather than generic filler.

EXAMPLE PATTERNS FOR ${actualLevel} LEVEL (for calibration and inspiration only):
${seeds.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}

These are just examples to show the difficulty level. You can:
- Pick from this list if they fit the topic
- Think of completely different patterns not on this list
- Mix patterns from the list with your own choices
- Prioritize what makes sense for "${topic}" over what's on the list

OUTPUT FORMAT (JSON only, no markdown):
{
  "points": [
    {
      "hanzi": "虽然…但是…",
      "pinyin": "suīrán... dànshì...",
      "english": "although... but...",
      "pattern": "虽然 [contrast] 但是 [result]",
      "whenToUse": "Show contrast between expectation and reality",
      "examples": [
        {
          "tier": "warmup",
          "hanzi": "虽然下雨了，但是我还是去了。",
          "pinyin": "Suīrán xià yǔ le, dànshì wǒ háishì qù le.",
          "english": "Although it rained, I still went."
        },
        {
          "tier": "target",
          "hanzi": "虽然他抱怨挺多的，但说实话他确实有点道理。",
          "pinyin": "Suīrán tā bàoyuàn tǐng duō de, dàn shuō shíhuà tā quèshí yǒudiǎn dàolǐ.",
          "english": "Although he complains a lot, honestly he does have a point."
        }
      ]
    }
  ]
}

CRITICAL REQUIREMENTS:
1. Return EXACTLY ${grammarCount} grammar point${grammarCount > 1 ? 's' : ''} (no more, no less).
2. Each point has EXACTLY 2 examples: warmup (easier, short, A1/A2-ish) and target (matches ${actualLevel}).
3. "pattern" should be very short (max 8-10 characters).
4. "whenToUse" is optional but keep it to 1 line if included.
5. All examples must be about or related to "${topic}".
6. Warmup examples are short and simple.
7. Target examples are natural, conversational, and level-appropriate.
8. Output ONLY valid JSON, no markdown code blocks.`

  try {
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
              'You are a helpful assistant that generates structured JSON data for Chinese language learning. Always respond with valid JSON only, no markdown formatting. Use your expertise to select appropriate grammar patterns for each topic and level.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 1.0, // Balanced randomness
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

    // Parse JSON response
    let text = content.trim()

    // Remove markdown code blocks if present
    if (text.startsWith('```')) {
      text = text.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '')
    }

    const result = JSON.parse(text) as GrammarFocusResult

    // Validate structure
    if (!result.points || !Array.isArray(result.points)) {
      throw new Error('Invalid response structure: missing points array')
    }

    if (result.points.length !== grammarCount) {
      console.warn(
        `Expected ${grammarCount} points, got ${result.points.length}. Using what we got.`
      )
    }

    // Validate each point
    for (const point of result.points) {
      if (
        !point.hanzi ||
        !point.pinyin ||
        !point.english ||
        !point.pattern ||
        !Array.isArray(point.examples) ||
        point.examples.length !== 2
      ) {
        throw new Error('Invalid grammar point structure')
      }

      for (const example of point.examples) {
        if (!example.hanzi || !example.pinyin || !example.english || !example.tier) {
          throw new Error('Invalid example structure')
        }
      }
    }

    return result
  } catch (error) {
    console.error('Error generating grammar focus:', error)

    // Fallback: return empty (UI will handle gracefully)
    return { points: [] }
  }
}
