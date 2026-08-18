import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  topic?: string
  level?: string
  why?: string
  daysAhead?: number
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Body
    const topic = typeof body.topic === 'string' ? body.topic.trim() : ''
    const level = typeof body.level === 'string' ? body.level.trim() : 'B1'
    const why = typeof body.why === 'string' ? body.why.trim() : ''
    const daysAhead = typeof body.daysAhead === 'number' && body.daysAhead > 0 ? body.daysAhead : 14

    if (!topic) {
      return NextResponse.json({ error: 'topic is required' }, { status: 400 })
    }

    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'DeepSeek not configured' }, { status: 500 })
    }

    const prompt = `You are writing microcopy for a Mandarin Chinese language learning app.

The user has chosen the topic: "${topic}"
Their current CEFR level: ${level}
Their learning goal: ${why || 'general fluency'}
They will complete this mini-journey in approximately ${daysAhead} days.

Write two short, vivid, honest descriptions in first-person present tense:
1. "today" — a single sentence (max 15 words) describing their CURRENT ability relevant to this topic. Should feel honest and slightly humbling, not embarrassing.
2. "future" — one to two sentences (max 25 words total) describing what they will be ABLE TO DO after ${daysAhead} days with this topic. Should feel achievable and specific, not hyperbolic.

Respond with ONLY valid JSON in this exact shape, no markdown:
{"today":"...","future":"..."}`

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[transformation] DeepSeek error:', err)
      return NextResponse.json({ error: 'AI generation failed' }, { status: 502 })
    }

    const json = await res.json()
    const raw = json?.choices?.[0]?.message?.content ?? '{}'
    let parsed: { today?: string; future?: string } = {}
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 502 })
    }

    if (!parsed.today || !parsed.future) {
      return NextResponse.json({ error: 'Incomplete AI response' }, { status: 502 })
    }

    return NextResponse.json({ today: parsed.today, future: parsed.future, daysAhead })
  } catch (err) {
    console.error('[transformation] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
