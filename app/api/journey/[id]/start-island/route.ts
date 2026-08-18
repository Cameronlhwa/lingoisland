import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isA0Level, seedA0IslandFromCourse } from '@/lib/a0Course'
import { getEntitlements } from '@/lib/entitlements'
import { pickRandomCoverKey } from '@/lib/islandLibrary'
import { normalizeSentenceStyle } from '@/lib/sentenceStyle'
import {
  journeysHasSentenceStyleColumn,
  topicIslandsHasSentenceStyleColumn,
} from '@/lib/supabase/schemaFeatures'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  order?: number
  sentenceStyle?: string
  level?: string
  cefrLevel?: string
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as Body
    const order = typeof body.order === 'number' ? body.order : 0
    if (order < 1 || order > 5) {
      return NextResponse.json({ error: 'order must be 1–5' }, { status: 400 })
    }

    const { data: journey, error: jErr } = await supabase
      .from('journeys')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (jErr || !journey) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 })
    }

    // Query by step_order only. Story nodes always get step_order 102/105 (well above
    // the 1-5 range validated above), so there is no risk of accidentally picking one.
    const { data: ji, error: jiErr } = await supabase
      .from('journey_islands')
      .select('*')
      .eq('journey_id', journey.id)
      .eq('step_order', order)
      .maybeSingle()

    if (jiErr || !ji) {
      console.error('[start-island] island lookup', { order, journeyId: journey.id, jiErr })
      return NextResponse.json({ error: 'Journey island not found' }, { status: 404 })
    }

    if (ji.island_id) {
      return NextResponse.json({ islandId: ji.island_id, alreadyStarted: true })
    }

    const entitlements = await getEntitlements(user.id)
    if (order > 1 && !entitlements.isPro) {
      return NextResponse.json(
        { error: 'Subscribe to unlock islands 2–5', code: 'PAYWALL_JOURNEY' },
        { status: 403 }
      )
    }

    const { data: up } = await supabase
      .from('user_profiles')
      .select('cefr_level')
      .eq('user_id', user.id)
      .maybeSingle()

    const profileLevel = up?.cefr_level || 'B1'
    const requestedLevel =
      typeof body.cefrLevel === 'string'
        ? body.cefrLevel.trim()
        : typeof body.level === 'string'
          ? body.level.trim()
          : ''
    const level = requestedLevel || profileLevel

    const topic = `${ji.name} — ${journey.topic}`

    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()
    if (!profileRow) {
      await supabase.from('profiles').insert({ id: user.id, plan: 'free' })
    }
    const { data: upRow } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!upRow) {
      await supabase.from('user_profiles').insert({ user_id: user.id, cefr_level: 'B1' })
    }

    const isA0 = isA0Level(level)
    // A0 island 1 uses the fixed 5-word mini-course; A1+ island 1 stays at 3.
    const wordTarget = order === 1 ? (isA0 ? 5 : 3) : 10
    const journeyHasStyleColumn = await journeysHasSentenceStyleColumn(supabase)
    const sentenceStyle = normalizeSentenceStyle(
      body.sentenceStyle ??
        (journeyHasStyleColumn ? journey.sentence_style : undefined),
    )

    const islandInsert: Record<string, unknown> = {
      user_id: user.id,
      topic,
      level,
      word_target: wordTarget,
      // A0 island 1 fixed course has no grammar-focus generation step.
      grammar_target: isA0 && order === 1 ? 0 : 1,
      status: 'draft',
      cover_key: pickRandomCoverKey(),
    }
    if (await topicIslandsHasSentenceStyleColumn(supabase)) {
      islandInsert.sentence_style = sentenceStyle
    }

    const { data: island, error: insErr } = await supabase
      .from('topic_islands')
      .insert(islandInsert)
      .select()
      .single()

    if (insErr || !island) {
      console.error('[start-island] insert', insErr)
      return NextResponse.json({ error: 'Failed to create island' }, { status: 500 })
    }

    const { error: linkErr } = await supabase
      .from('journey_islands')
      .update({ island_id: island.id })
      .eq('id', ji.id)

    if (linkErr) {
      await supabase.from('topic_islands').delete().eq('id', island.id)
      return NextResponse.json({ error: 'Failed to link island' }, { status: 500 })
    }

    // A0 island 1 only: seed fixed course content — do not call generate-batch.
    // A0 islands 2–5 (post-paywall) still use the normal AI pipeline.
    if (isA0 && order === 1) {
      const seeded = await seedA0IslandFromCourse(supabase, {
        islandId: island.id,
        userId: user.id,
      })
      if (!seeded.ok) {
        console.error('[start-island] A0 seed failed', seeded.error)
        await supabase.from('journey_islands').update({ island_id: null }).eq('id', ji.id)
        await supabase.from('topic_islands').delete().eq('id', island.id)
        return NextResponse.json(
          { error: seeded.error || 'Failed to seed A0 course' },
          { status: 500 },
        )
      }
      return NextResponse.json({ islandId: island.id })
    }

    const sentenceTierMode = 'full'
    const origin = new URL(request.url).origin
    const cookieHeader = request.headers.get('cookie') ?? ''
    void fetch(`${origin}/api/topic-islands/${island.id}/generate-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({ sentenceTierMode, sentenceStyle }),
    }).catch((err) => console.error('[start-island] generate-batch', err))

    return NextResponse.json({ islandId: island.id })
  } catch (e) {
    console.error('[journey/start-island]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
