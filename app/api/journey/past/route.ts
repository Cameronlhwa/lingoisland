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

    // Return ALL of the user's journeys — active, in-progress, and completed.
    const { data: journeys, error } = await supabase
      .from('journeys')
      .select('*, journey_islands(*, linked_island:island_id(word_target, status))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'Failed to load past journeys' }, { status: 500 })
    }

    const result = (journeys ?? []).map((journey) => ({
      ...journey,
      journey_islands: ((journey.journey_islands ?? []) as any[])
        .map((row: any) => {
          const stepOrder = Number(row.step_order ?? 0)

          // Always derive node_type from step_order — the DB default is 'island' so
          // old story rows (step_order 102/105) may have node_type = 'island' in the column.
          const nodeType: 'island' | 'story' = stepOrder > 100 ? 'story' : 'island'

          // Use stored position only when it's a valid path position (< 100).
          // Old rows were backfilled with position = step_order, giving 102/105 for stories.
          // 7-node path: I1(1) · I2(2) · SA(3) · I3(4) · I4(5) · I5(6) · SB(7)
          const storedPosition = row.position != null ? Number(row.position) : null
          let position: number
          if (storedPosition != null && storedPosition < 100) {
            position = storedPosition
          } else if (nodeType === 'story') {
            position = stepOrder === 102 ? 3 : 7
          } else {
            const posMap: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 5, 5: 6 }
            position = posMap[stepOrder] ?? stepOrder
          }

          // Resolve word_count from (in priority order):
          // 1. DB column (if migration applied)
          // 2. Linked topic_island word_target (actual value when island was generated)
          // 3. Design rule: island 1 = 5 words, islands 2-5 = 10 words
          const linkedWordTarget = row.linked_island?.word_target ?? null
          const wordCount: number | null = nodeType === 'story'
            ? null
            : (row.word_count ?? linkedWordTarget ?? (stepOrder === 1 ? 5 : 10))

          // Strip the nested join object before returning
          const { linked_island: _drop, ...rest } = row
          return { ...rest, node_type: nodeType, position, word_count: wordCount }
        })
        .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0)),
    }))

    return NextResponse.json({ journeys: result })
  } catch (e) {
    console.error('[journey/past]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
