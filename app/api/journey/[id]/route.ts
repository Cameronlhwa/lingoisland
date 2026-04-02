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

    const nodesOut = (islands ?? []).map((row: any) => {
      const stepOrder = Number(row.step_order ?? 0)

      // Always derive node_type from step_order — the DB default is 'island' so
      // old story rows (step_order 102/105) may have node_type = 'island' in the column.
      const nodeType: 'island' | 'story' = stepOrder > 100 ? 'story' : 'island'

      // Use the stored position only when it's a valid path position (< 100).
      // Old rows were backfilled with position = step_order, giving 102/105 for stories.
      // 7-node path: I1(1) · I2(2) · SA(3) · I3(4) · I4(5) · I5(6) · SB(7)
      const storedPosition = row.position != null ? Number(row.position) : null
      let position: number
      if (storedPosition != null && storedPosition < 100) {
        position = storedPosition
      } else if (nodeType === 'story') {
        position = stepOrder === 102 ? 3 : 7
      } else {
        const map: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 5, 5: 6 }
        position = map[stepOrder] ?? stepOrder
      }

      return { ...row, order: stepOrder, node_type: nodeType, position }
    })
    const islandsOut = nodesOut.filter((row) => row.node_type !== 'story')

    return NextResponse.json({ journey, islands: islandsOut, nodes: nodesOut })
  } catch (e) {
    console.error('[journey/id GET]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
