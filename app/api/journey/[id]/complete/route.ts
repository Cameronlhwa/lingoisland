import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Body = {
  journeyIslandId?: string
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
    const journeyIslandId = body.journeyIslandId
    if (!journeyIslandId || typeof journeyIslandId !== 'string') {
      return NextResponse.json(
        { error: 'journeyIslandId is required' },
        { status: 400 }
      )
    }

    const { data: ji, error: findErr } = await supabase
      .from('journey_islands')
      .select('id, journey_id')
      .eq('id', journeyIslandId)
      .eq('journey_id', params.id)
      .maybeSingle()

    if (findErr || !ji) {
      return NextResponse.json({ error: 'Journey island not found' }, { status: 404 })
    }

    const { data: journeyRow } = await supabase
      .from('journeys')
      .select('user_id')
      .eq('id', ji.journey_id)
      .single()

    if (!journeyRow || journeyRow.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date().toISOString()
    const { error: upErr } = await supabase
      .from('journey_islands')
      .update({ completed_at: now })
      .eq('id', journeyIslandId)

    if (upErr) {
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    // node_type column may not exist yet in DB; use step_order < 100 to identify islands.
    // Stories use step_order 102 and 105 in the legacy schema.
    const { data: all } = await supabase
      .from('journey_islands')
      .select('completed_at, step_order')
      .eq('journey_id', params.id)

    const islandRows = (all ?? []).filter((r) => Number(r.step_order ?? 0) < 100)
    const done = islandRows.length > 0 && islandRows.every((r) => r.completed_at)

    if (done) {
      await supabase
        .from('journeys')
        .update({ completed_at: now })
        .eq('id', params.id)
    }

    return NextResponse.json({ ok: true, journeyCompleted: !!done })
  } catch (e) {
    console.error('[journey/complete]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
