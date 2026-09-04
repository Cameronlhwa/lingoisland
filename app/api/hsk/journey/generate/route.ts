import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import {
  generateHskJourneyPlan,
  type HskMotivation,
} from '@/lib/deepseek/generate-hsk-journey'
import { HSK_STANDARD_COOKIE, resolveHskStandard } from '@/lib/hsk/standardPreference'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MOTIVATIONS: HskMotivation[] = ['school', 'job', 'heritage', 'hobby']
const LEVEL_SOURCES = ['official', 'checklist'] as const

type Body = {
  targetLevel?: number
  motivation?: string
  personalizationText?: string
  dailyTimeMinutes?: number
  timeLabel?: string
  currentLevel?: number
  levelSource?: string
  /** ISO date (YYYY-MM-DD) if the user has an HSK exam date in mind, else null. */
  testDate?: string | null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const MINS_MAP: Record<string, number> = {
  '5min': 5,
  '15min': 15,
  '30min': 30,
  '1h+': 60,
}
const HARDCODED_DAYS_PER_WEEK = 4

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const body = (await request.json().catch(() => ({}))) as Body

    const targetLevel = Number(body.targetLevel)
    const motivation = body.motivation as HskMotivation
    const personalizationText =
      typeof body.personalizationText === 'string' ? body.personalizationText.trim() : ''

    if (!Number.isInteger(targetLevel) || targetLevel < 1 || targetLevel > 7) {
      return NextResponse.json({ error: 'targetLevel must be an integer 1-7' }, { status: 400 })
    }
    if (!MOTIVATIONS.includes(motivation)) {
      return NextResponse.json({ error: 'invalid motivation' }, { status: 400 })
    }
    if (!personalizationText) {
      return NextResponse.json({ error: 'personalizationText is required' }, { status: 400 })
    }

    const dailyMinutes =
      typeof body.dailyTimeMinutes === 'number' && body.dailyTimeMinutes > 0
        ? body.dailyTimeMinutes
        : MINS_MAP[body.timeLabel ?? '15min'] ?? 15
    const wordsPerWeek = Math.round((dailyMinutes / 15) * HARDCODED_DAYS_PER_WEEK * 10)

    const plan = await generateHskJourneyPlan({ targetLevel, motivation, personalizationText })

    const islandRows = plan.islands.map((island) => ({
      type: 'island' as const,
      position: island.position <= 2 ? island.position : island.position + 1,
      stepOrder: island.position,
      name: island.topic,
      zh: island.zh,
      wordCount: island.wordCount,
    }))
    const storyRows = plan.stories.map((story) => ({
      type: 'story' as const,
      position: story.afterIsland === 2 ? 3 : 7,
      stepOrder: story.afterIsland === 2 ? 102 : 105,
      name: story.title,
      hint: story.hint,
    }))

    // Pull real HSK vocabulary to tag onto islands (DeepSeek only supplies the theme,
    // never invents real HSK word lists — see generate-hsk-journey.ts).
    const totalWordsNeeded = islandRows.reduce((sum, i) => sum + i.wordCount, 0)
    let profileStandard: string | null = null
    if (user) {
      const { data: standardProfile, error: standardErr } = await supabase
        .from('user_profiles')
        .select('hsk_standard')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!standardErr) {
        profileStandard = standardProfile?.hsk_standard ?? null
      }
    }
    const cookieStore = await cookies()
    const hskStandard = resolveHskStandard({
      profile: profileStandard,
      cookie: cookieStore.get(HSK_STANDARD_COOKIE)?.value,
    })
    const { data: wordPool, error: wordPoolErr } = await supabase
      .from('hsk_words')
      .select('id, hanzi, pinyin, english, level')
      .eq('standard', hskStandard)
      .lte('level', targetLevel)
      .eq('is_placeholder', false)
      .order('level', { ascending: false })
      .order('sort_order', { ascending: true, nullsFirst: false })
      .limit(totalWordsNeeded)

    if (wordPoolErr) {
      console.warn('[hsk/journey/generate] hsk_words fetch failed', wordPoolErr)
    }
    const pool = wordPool ?? []

    let cursor = 0
    const islandsWithWords = islandRows.map((island) => {
      const words = pool.slice(cursor, cursor + island.wordCount)
      cursor += island.wordCount
      return { ...island, words }
    })

    // Unauthenticated preview: return the plan without persisting.
    if (!user) {
      return NextResponse.json({
        preview: {
          framingPhrase: plan.framingPhrase,
          journeyTitle: plan.journeyTitle,
          wordsPerWeek,
          islands: islandsWithWords.map((island) => ({
            id: `preview-${island.stepOrder}`,
            order: island.stepOrder,
            name: island.name,
            zh: island.zh,
            word_count: island.wordCount,
            level: targetLevel,
            words: island.words,
          })),
          stories: plan.stories.map((story) => ({
            afterIsland: story.afterIsland,
            title: story.title,
            hint: story.hint,
          })),
          upcomingUnits: plan.upcomingUnits,
        },
      })
    }

    const profileUpdate: Record<string, unknown> = {
      user_id: user.id,
      product_track: 'hsk',
      hsk_target_level: targetLevel,
      hsk_motivation: motivation,
      hsk_personalization_text: personalizationText,
      daily_time_minutes: dailyMinutes,
    }
    if (typeof body.currentLevel === 'number' && body.currentLevel >= 1 && body.currentLevel <= 6) {
      profileUpdate.hsk_current_level = body.currentLevel
    }
    if (typeof body.levelSource === 'string' && (LEVEL_SOURCES as readonly string[]).includes(body.levelSource)) {
      profileUpdate.hsk_level_source = body.levelSource
    }
    if (body.testDate === null) {
      profileUpdate.test_date = null
    } else if (typeof body.testDate === 'string' && DATE_RE.test(body.testDate)) {
      profileUpdate.test_date = body.testDate
    }
    const { error: profileErr } = await supabase
      .from('user_profiles')
      .upsert(profileUpdate, { onConflict: 'user_id' })
    if (profileErr) {
      console.warn('[hsk/journey/generate] user_profiles upsert failed', profileErr)
    }

    const { data: journey, error: journeyErr } = await supabase
      .from('journeys')
      .insert({
        user_id: user.id,
        topic: plan.journeyTitle,
        why: personalizationText,
        time_label: body.timeLabel ?? null,
        days_per_week: HARDCODED_DAYS_PER_WEEK,
        words_per_week: wordsPerWeek,
      })
      .select()
      .single()

    if (journeyErr || !journey) {
      console.error('[hsk/journey/generate] insert journey', journeyErr)
      return NextResponse.json({ error: 'Failed to save journey' }, { status: 500 })
    }

    const islandInsertRows = islandsWithWords.map((island) => ({
      journey_id: journey.id,
      step_order: island.stepOrder,
      position: island.position,
      node_type: 'island' as const,
      name: island.name,
      zh: island.zh,
      story_idea: null,
      word_count: island.wordCount,
      hint: null,
    }))
    const storyInsertRows = storyRows.map((story) => ({
      journey_id: journey.id,
      step_order: story.stepOrder,
      position: story.position,
      node_type: 'story' as const,
      name: story.name,
      zh: null,
      story_idea: null,
      word_count: null,
      hint: story.hint,
    }))

    const { data: insertedIslands, error: insertErr } = await supabase
      .from('journey_islands')
      .insert([...islandInsertRows, ...storyInsertRows])
      .select('id, step_order, node_type')

    if (insertErr || !insertedIslands) {
      console.error('[hsk/journey/generate] insert islands', insertErr)
      await supabase.from('journeys').delete().eq('id', journey.id)
      return NextResponse.json({ error: 'Failed to save journey islands' }, { status: 500 })
    }

    // Tag each island with the real HSK words it teaches.
    const tagRows: { journey_island_id: string; hsk_word_id: string }[] = []
    for (const row of insertedIslands) {
      if (row.node_type !== 'island') continue
      const island = islandsWithWords.find((i) => i.stepOrder === row.step_order)
      if (!island) continue
      for (const word of island.words) {
        tagRows.push({ journey_island_id: row.id, hsk_word_id: word.id })
      }
    }
    if (tagRows.length > 0) {
      const { error: tagErr } = await supabase.from('journey_island_hsk_words').insert(tagRows)
      if (tagErr) {
        console.warn('[hsk/journey/generate] journey_island_hsk_words insert failed', tagErr)
      }
    }

    const { error: activeJourneyErr } = await supabase
      .from('profiles')
      .update({ active_journey_id: journey.id })
      .eq('id', user.id)
    if (activeJourneyErr) {
      console.warn('[hsk/journey/generate] active_journey_id update', activeJourneyErr)
    }

    return NextResponse.json({
      journeyId: journey.id,
      framingPhrase: plan.framingPhrase,
      journeyTitle: plan.journeyTitle,
      wordsPerWeek,
      targetLevel,
      islands: islandsWithWords.map((island) => ({
        order: island.stepOrder,
        name: island.name,
        zh: island.zh,
        word_count: island.wordCount,
        words: island.words,
      })),
      stories: plan.stories.map((story) => ({
        afterIsland: story.afterIsland,
        title: story.title,
        hint: story.hint,
      })),
      upcomingUnits: plan.upcomingUnits,
    })
  } catch (e) {
    console.error('[hsk/journey/generate]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500 }
    )
  }
}
