import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('active_journey_id')
      .eq('id', user.id)
      .maybeSingle()

    const jid = profile?.active_journey_id
    if (!jid) {
      return NextResponse.json({ journey: null, islands: [] })
    }

    const { data: journey, error: jErr } = await supabase
      .from('journeys')
      .select('*')
      .eq('id', jid)
      .eq('user_id', user.id)
      .maybeSingle()

    if (jErr || !journey) {
      return NextResponse.json({ journey: null, islands: [] })
    }

    const { data: islands } = await supabase
      .from('journey_islands')
      .select('*')
      .eq('journey_id', journey.id)
      .order('step_order', { ascending: true })

    const nodesOut = (islands ?? []).map((row: any) => {
      const stepOrder = Number(row.step_order ?? 0)

      if (row.node_type != null && row.position != null) {
        return { ...row, order: stepOrder }
      }

      // Legacy schema — remap to 7-node path positions.
      // 7-node path: I1(1) · I2(2) · SA(3) · I3(4) · I4(5) · I5(6) · SB(7)
      const nodeType: 'island' | 'story' = stepOrder > 100 ? 'story' : 'island'
      let position: number
      if (nodeType === 'story') {
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
    console.error('[journey/active]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
