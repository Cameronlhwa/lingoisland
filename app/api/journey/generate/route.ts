import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateJourneyPlan } from '@/lib/deepseek/generate-journey'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  topic?: string
  why?: string
  level?: string
  timeLabel?: string
  daysPerWeek?: number
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as Body
    const topic = typeof body.topic === 'string' ? body.topic.trim() : ''
    const why = typeof body.why === 'string' ? body.why.trim() : ''
    const level = typeof body.level === 'string' ? body.level.trim() : 'B1'
    const timeLabel = typeof body.timeLabel === 'string' ? body.timeLabel : '15min'
    const daysPerWeek =
      typeof body.daysPerWeek === 'number' && body.daysPerWeek > 0
        ? body.daysPerWeek
        : 4

    if (!topic || !why) {
      return NextResponse.json(
        { error: 'topic and why are required' },
        { status: 400 }
      )
    }

    const minsMap: Record<string, number> = {
      '5min': 5,
      '15min': 15,
      '30min': 30,
      '1h+': 60,
    }
    const mins = minsMap[timeLabel] ?? 15
    const wordsPerWeek = Math.round((mins / 15) * daysPerWeek * 10)

    const plan = await generateJourneyPlan({ topic, why, level })

    const { data: journey, error: jErr } = await supabase
      .from('journeys')
      .insert({
        user_id: user.id,
        topic: plan.journeyTitle || topic,
        why,
        time_label: timeLabel,
        days_per_week: daysPerWeek,
        words_per_week: wordsPerWeek,
      })
      .select()
      .single()

    if (jErr || !journey) {
      console.error('[journey/generate] insert journey', jErr)
      return NextResponse.json(
        { error: 'Failed to save journey' },
        { status: 500 }
      )
    }

    const rows = plan.islands
      .sort((a, b) => a.order - b.order)
      .map((island) => ({
        journey_id: journey.id,
        step_order: island.order,
        name: island.name,
        zh: island.zh,
        story_idea: island.storyIdea,
      }))

    const { error: jiErr } = await supabase.from('journey_islands').insert(rows)
    if (jiErr) {
      console.error('[journey/generate] insert islands', jiErr)
      await supabase.from('journeys').delete().eq('id', journey.id)
      return NextResponse.json(
        { error: 'Failed to save journey islands' },
        { status: 500 }
      )
    }

    const { error: profileErr } = await supabase
      .from('profiles')
      .update({ active_journey_id: journey.id })
      .eq('id', user.id)

    if (profileErr) {
      console.warn('[journey/generate] active_journey_id update', profileErr)
    }

    return NextResponse.json({ journeyId: journey.id })
  } catch (e) {
    console.error('[journey/generate]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 }
    )
  }
}
