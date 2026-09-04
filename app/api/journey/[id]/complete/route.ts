import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { advanceCurriculumAfterUnitComplete } from '@/lib/hsk/curriculum'
import {
  markCurriculumIslandWordsLearned,
  type CurriculumSeedWord,
} from '@/lib/hsk/seedCurriculumIsland'

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
      .select('id, journey_id, node_type, seed_words')
      .eq('id', journeyIslandId)
      .eq('journey_id', params.id)
      .maybeSingle()

    if (findErr || !ji) {
      return NextResponse.json({ error: 'Journey island not found' }, { status: 404 })
    }

    const { data: journeyRow } = await supabase
      .from('journeys')
      .select('user_id, curriculum_unit_id')
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

    // Curriculum unit: finishing an island marks the HSK words it taught as learned.
    if (journeyRow.curriculum_unit_id && ji.node_type !== 'story') {
      const seeds = (Array.isArray(ji.seed_words)
        ? ji.seed_words
        : []) as CurriculumSeedWord[]
      const hskWordIds = seeds
        .map((s) => s.hsk_word_id)
        .filter((v): v is string => typeof v === 'string')
      try {
        await markCurriculumIslandWordsLearned(supabase, {
          userId: user.id,
          hskWordIds,
        })
      } catch (e) {
        console.warn('[journey/complete] markCurriculumIslandWordsLearned', e)
      }
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

      if (journeyRow.curriculum_unit_id) {
        try {
          await advanceCurriculumAfterUnitComplete(supabase, {
            journeyId: params.id,
            userId: user.id,
          })
        } catch (e) {
          console.warn('[journey/complete] advanceCurriculumAfterUnitComplete', e)
        }
      }
    }

    return NextResponse.json({ ok: true, journeyCompleted: !!done })
  } catch (e) {
    console.error('[journey/complete]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
