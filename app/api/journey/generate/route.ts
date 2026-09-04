import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getFixedA0JourneyPlan, isA0Level } from '@/lib/a0Course'
import { generateJourneyPlan } from '@/lib/deepseek/generate-journey'
import { normalizeSentenceStyle } from '@/lib/sentenceStyle'
import { journeysHasSentenceStyleColumn } from '@/lib/supabase/schemaFeatures'
import { hskProfileFieldsFromCefr } from '@/lib/levelBands'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type SavedNode = {
  node_type?: string
  position?: number
  step_order?: number
  name?: string
  zh?: string | null
  hint?: string | null
  word_count?: number | null
}

type Body = {
  topic?: string
  why?: string
  level?: string
  cefrLevel?: string
  timeLabel?: string
  daysPerWeek?: number
  dailyMinutes?: number
  learningGoal?: string
  sentenceStyle?: string
  /** Pre-generated plan nodes from the unauthenticated preview — skips DeepSeek */
  savedNodes?: SavedNode[]
  /** Set by the ?track=hsk onboarding entry point. */
  track?: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const body = (await request.json().catch(() => ({}))) as Body
    const topic = typeof body.topic === 'string' ? body.topic.trim() : ''
    const why =
      typeof body.learningGoal === 'string'
        ? body.learningGoal.trim()
        : typeof body.why === 'string'
          ? body.why.trim()
          : ''
    const level =
      typeof body.cefrLevel === 'string'
        ? body.cefrLevel.trim()
        : typeof body.level === 'string'
          ? body.level.trim()
          : 'B1'
    const timeLabel = typeof body.timeLabel === 'string' ? body.timeLabel : '15min'
    const dailyMinutes =
      typeof body.dailyMinutes === 'number' && body.dailyMinutes > 0
        ? body.dailyMinutes
        : null
    const daysPerWeek =
      typeof body.daysPerWeek === 'number' && body.daysPerWeek > 0
        ? body.daysPerWeek
        : 4
    const sentenceStyle = normalizeSentenceStyle(body.sentenceStyle)

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
    const mins = dailyMinutes ?? minsMap[timeLabel] ?? 15
    const wordsPerWeek = Math.round((mins / 15) * daysPerWeek * 10)

    // ---------- Build the journey plan ----------
    // Fast path: reuse the pre-generated nodes the client saved before login.
    // This skips the DeepSeek call, preserves stories, and avoids the double-wait UX.
    type IslandRow = { type: 'island'; position: number; stepOrder: number; name: string; zh: string | null; wordCount: number }
    type StoryRow  = { type: 'story';  position: number; stepOrder: number; name: string; hint: string }

    let islandRows: IslandRow[]
    let storyRows: StoryRow[]
    let planTitle: string

    const hasSavedNodes = user && Array.isArray(body.savedNodes) && body.savedNodes.length > 0

    if (hasSavedNodes) {
      const pn = body.savedNodes as SavedNode[]
      planTitle = topic
      islandRows = pn
        .filter((n) => (n.node_type ?? 'island') === 'island')
        .map((n) => ({
          type: 'island' as const,
          position: Number(n.position ?? 1),
          stepOrder: Number(n.step_order ?? n.position ?? 1),
          name: String(n.name ?? ''),
          zh: n.zh ?? null,
          wordCount: Number(n.word_count ?? 10),
        }))
      storyRows = pn
        .filter((n) => n.node_type === 'story')
        .map((n) => ({
          type: 'story' as const,
          position: Number(n.position ?? 3),
          stepOrder: Number(n.step_order ?? 102),
          name: String(n.name ?? 'Story checkpoint'),
          hint: String(n.hint ?? ''),
        }))
    } else if (isA0Level(level)) {
      // A0: fully fixed journey plan — no DeepSeek call, no generation latency.
      const plan = getFixedA0JourneyPlan(topic)
      planTitle = plan.journeyTitle || topic
      islandRows = plan.islands
        .sort((a, b) => a.position - b.position)
        .map((island) => ({
          type: 'island' as const,
          // 7-node order: I1, I2, S1, I3, I4, I5, S2
          position: island.position <= 2 ? island.position : island.position + 1,
          stepOrder: island.position,
          name: island.topic,
          zh: island.zh,
          wordCount: island.position === 1 ? 5 : 10,
        }))
      storyRows = plan.stories.map((story) => ({
        type: 'story' as const,
        position: story.afterIsland === 2 ? 3 : 7,
        stepOrder: story.afterIsland === 2 ? 102 : 105,
        name: story.title,
        hint: story.hint,
      }))
    } else {
      const plan = await generateJourneyPlan({ topic, why, level })
      planTitle = plan.journeyTitle || topic
      islandRows = plan.islands
        .sort((a, b) => a.position - b.position)
        .map((island) => ({
          type: 'island' as const,
          // 7-node order: I1, I2, S1, I3, I4, I5, S2
          position: island.position <= 2 ? island.position : island.position + 1,
          stepOrder: island.position,
          name: island.topic,
          zh: island.zh,
          wordCount: island.position === 1 ? 3 : 10,
        }))
      storyRows = plan.stories.map((story) => ({
        type: 'story' as const,
        position: story.afterIsland === 2 ? 3 : 7,
        stepOrder: story.afterIsland === 2 ? 102 : 105,
        name: story.title,
        hint: story.hint,
      }))
    }

    // Public onboarding preview: generate a path without persisting until user signs in.
    if (!user) {
      return NextResponse.json({
        preview: {
          journey: {
            topic: planTitle,
            words_per_week: wordsPerWeek,
          },
          islands: islandRows.map((island) => ({
            id: `preview-${island.stepOrder}`,
            order: island.stepOrder,
            name: island.name,
            zh: island.zh,
            story_idea: null,
            node_type: island.type,
            position: island.position,
            word_count: island.wordCount,
          })),
          nodes: [...islandRows, ...storyRows]
            .sort((a, b) => a.position - b.position)
            .map((node) => ({
              id: `preview-node-${node.position}`,
              node_type: node.type,
              position: node.position,
              step_order: node.stepOrder,
              name: node.name,
              zh: 'zh' in node ? node.zh : null,
              hint: 'hint' in node ? node.hint : null,
              word_count: 'wordCount' in node ? node.wordCount : null,
              island_id: null,
              completed_at: null,
            })),
        },
      })
    }

    const journeyInsert: Record<string, unknown> = {
      user_id: user.id,
      topic: planTitle,
      why,
      time_label: timeLabel,
      days_per_week: daysPerWeek,
      words_per_week: wordsPerWeek,
    }
    if (await journeysHasSentenceStyleColumn(supabase)) {
      journeyInsert.sentence_style = sentenceStyle
    }

    const { data: journey, error: jErr } = await supabase
      .from('journeys')
      .insert(journeyInsert)
      .select()
      .single()

    if (jErr || !journey) {
      console.error('[journey/generate] insert journey', jErr)
      return NextResponse.json(
        { error: 'Failed to save journey' },
        { status: 500 }
      )
    }

    // Keep profile CEFR aligned with the selected journey level so island generation
    // reflects what the user picked during onboarding. Also dual-write HSK fields
    // (and stamp product_track when ?track=hsk) after auth is guaranteed.
    const hskFields = hskProfileFieldsFromCefr(level, {
      setTarget: body.track === 'hsk',
    })
    const hskStub =
      body.track === 'hsk'
        ? { product_track: 'hsk' as const, ...hskFields }
        : hskFields
    const { error: upsertProfileErr } = await supabase
      .from('user_profiles')
      .upsert(
        { user_id: user.id, cefr_level: level, ...hskStub },
        { onConflict: 'user_id' }
      )
    if (upsertProfileErr) {
      console.warn('[journey/generate] user_profiles upsert', upsertProfileErr)
    }

    const rows = [
      ...islandRows.map((island) => ({
        journey_id: journey.id,
        step_order: island.stepOrder,
        position: island.position,
        node_type: island.type,
        name: island.name,
        zh: island.zh,
        story_idea: null,
        word_count: island.wordCount,
        hint: null,
      })),
      ...storyRows.map((story) => ({
        journey_id: journey.id,
        step_order: story.stepOrder,
        position: story.position,
        node_type: story.type,
        name: story.name,
        zh: null,
        story_idea: null,
        word_count: null,
        hint: story.hint,
      })),
    ]
    const insertJourneyIslands = async () => {
      const primary = await supabase.from('journey_islands').insert(rows)
      if (!primary.error) return { ok: true as const }

      // Backward-compatible fallback for environments where new columns
      // (node_type/position/hint/word_count) are not migrated yet.
      const isMissingNewColumns =
        primary.error.code === 'PGRST204' &&
        /node_type|position|hint|word_count|story_id/i.test(primary.error.message || '')
      if (!isMissingNewColumns) {
        return { ok: false as const, error: primary.error }
      }

      console.warn('[journey/generate] falling back to legacy journey_islands insert', primary.error)

      // Include story rows using the original schema columns (step_order, name, zh, story_idea).
      // story_idea stores the hint text so the data is preserved when migrations land.
      const legacyRows = [
        ...islandRows.map((island) => ({
          journey_id: journey.id,
          step_order: island.stepOrder,
          name: island.name,
          zh: island.zh,
          story_idea: null as string | null,
        })),
        ...storyRows.map((story) => ({
          journey_id: journey.id,
          step_order: story.stepOrder,
          name: story.name,
          zh: null as string | null,
          story_idea: story.hint || null,
        })),
      ]
      const fallback = await supabase.from('journey_islands').insert(legacyRows)
      if (fallback.error) {
        return { ok: false as const, error: fallback.error }
      }
      return { ok: true as const }
    }

    const insertResult = await insertJourneyIslands()
    if (!insertResult.ok) {
      console.error('[journey/generate] insert islands', insertResult.error)
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
