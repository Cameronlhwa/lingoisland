import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
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

    const { data: journey, error: jErr } = await supabase
      .from('journeys')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (jErr || !journey) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 })
    }

    const { data: islands, error: iErr } = await supabase
      .from('journey_islands')
      .select('*')
      .eq('journey_id', params.id)
      .order('step_order', { ascending: true })

    if (iErr) {
      return NextResponse.json({ error: 'Failed to load islands' }, { status: 500 })
    }

    // node_type and position are trusted directly from the column — both have
    // been correctly populated since 20260326_000001_journey_nodes.sql, and any
    // stray legacy rows were backfilled by 20260912_000001_pronunciation_practice.sql.
    const nodesOut = (islands ?? []).map((row: any) => {
      const stepOrder = Number(row.step_order ?? 0)
      const nodeType: 'island' | 'story' | 'tone_practice' = row.node_type ?? 'island'
      const position = row.position != null ? Number(row.position) : stepOrder
      return { ...row, order: stepOrder, node_type: nodeType, position }
    })
    const islandsOut = nodesOut.filter((row) => row.node_type === 'island')

    return NextResponse.json({ journey, islands: islandsOut, nodes: nodesOut })
  } catch (e) {
    console.error('[journey/id GET]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
