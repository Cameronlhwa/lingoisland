import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEntitlements } from '@/lib/entitlements'
import { pickRandomCoverKey } from '@/lib/islandLibrary'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Body = {
  order?: number
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

    const { data: ji, error: jiErr } = await supabase
      .from('journey_islands')
      .select('*')
      .eq('journey_id', journey.id)
      .eq('step_order', order)
      .maybeSingle()

    if (jiErr || !ji) {
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

    const level = up?.cefr_level || 'B1'

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

    const { data: island, error: insErr } = await supabase
      .from('topic_islands')
      .insert({
        user_id: user.id,
        topic,
        level,
        word_target: 10,
        grammar_target: 0,
        status: 'draft',
        cover_key: pickRandomCoverKey(),
      })
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

    const sentenceTierMode = order === 1 ? 'easy_same' : 'full'
    const origin = new URL(request.url).origin
    const cookieHeader = request.headers.get('cookie') ?? ''
    void fetch(`${origin}/api/topic-islands/${island.id}/generate-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({ sentenceTierMode }),
    }).catch((err) => console.error('[start-island] generate-batch', err))

    return NextResponse.json({ islandId: island.id })
  } catch (e) {
    console.error('[journey/start-island]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
