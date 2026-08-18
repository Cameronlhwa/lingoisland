import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEntitlements, isWordLocked, canCreateTopicIsland } from '@/lib/entitlements'

/**
 * GET /api/topic-islands/[id]
 * Get island with words and sentences
 */
export async function GET(
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

    const islandId = params.id

    // Get island
    const { data: island, error: islandError } = await supabase
      .from('topic_islands')
      .select('*')
      .eq('id', islandId)
      .eq('user_id', user.id)
      .single()

    if (islandError || !island) {
      return NextResponse.json(
        { error: 'Island not found or access denied' },
        { status: 404 }
      )
    }

    // Get user entitlements
    const entitlements = await getEntitlements(user.id)

    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('cefr_level')
      .eq('user_id', user.id)
      .maybeSingle()

    // Get words (order by position, then created_at as fallback)
    const { data: words } = await supabase
      .from('island_words')
      .select('*')
      .eq('island_id', islandId)
      .order('position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })

    // Get sentences grouped by word
    const { data: sentences } = await supabase
      .from('island_sentences')
      .select('*')
      .eq('island_id', islandId)
      .order('word_id, tier', { ascending: true })

    // Get grammar focus points
    const { data: grammarFocus } = await supabase
      .from('island_grammar_focus')
      .select('*')
      .eq('island_id', islandId)
      .order('position', { ascending: true })

    // Get grammar examples for each focus point
    const { data: grammarExamples } = await supabase
      .from('island_grammar_examples')
      .select('*')
      .in('grammar_focus_id', (grammarFocus || []).map(g => g.id))

    // Attach examples to grammar focus points
    const grammarFocusWithExamples = (grammarFocus || []).map(focus => ({
      ...focus,
      examples: (grammarExamples || []).filter(ex => ex.grammar_focus_id === focus.id)
    }))

    const { count: topicIslandCount } = await supabase
      .from('topic_islands')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    const createIslandEligibility = await canCreateTopicIsland(user.id)

    const { data: jiRow } = await supabase
      .from('journey_islands')
      .select('id, step_order, name, zh, journey_id')
      .eq('island_id', islandId)
      .maybeSingle()

    let journeyContext: {
      journeyIslandId: string
      order: number
      journeyId: string
      name: string
      zh: string | null
      journeyTopic: string
      wordsPerWeek: number
      lockedIslands: Array<{
        order: number
        name: string
        zh: string | null
        node_type: 'island' | 'story'
        hint: string | null
      }>
    } | null = null

    if (jiRow) {
      const { data: jr } = await supabase
        .from('journeys')
        .select('topic, words_per_week')
        .eq('id', jiRow.journey_id)
        .maybeSingle()
      // Select only stable columns; infer node_type from step_order so the
      // query works even before the 20260326 migration adds the node_type column.
      const { data: siblings } = await supabase
        .from('journey_islands')
        .select('step_order, name, zh')
        .eq('journey_id', jiRow.journey_id)
        .gt('step_order', 1)
        .order('step_order', { ascending: true })

      // Opportunistically fetch hint/node_type if the newer columns exist.
      const { data: siblingsExtended } = await supabase
        .from('journey_islands')
        .select('step_order, node_type, hint')
        .eq('journey_id', jiRow.journey_id)
        .gt('step_order', 1)
        .order('step_order', { ascending: true })
      const extendedMap = new Map(
        (siblingsExtended ?? []).map((r) => [r.step_order, r])
      )

      journeyContext = {
        journeyIslandId: jiRow.id,
        order: jiRow.step_order,
        journeyId: jiRow.journey_id,
        name: jiRow.name,
        zh: jiRow.zh,
        journeyTopic: jr?.topic ?? '',
        wordsPerWeek: jr?.words_per_week ?? 0,
        lockedIslands: (siblings ?? []).map((s) => {
          const ext = extendedMap.get(s.step_order)
          // Stories are always placed at step_order > 100 in the generator
          const inferredType: 'island' | 'story' = s.step_order > 100 ? 'story' : 'island'
          return {
            order: s.step_order,
            name: s.name,
            zh: s.zh ?? null,
            node_type: ((ext?.node_type ?? inferredType) as 'island' | 'story'),
            hint: ext?.hint ?? null,
          }
        }),
      }
    }

    // Attach sentences to words
    // Words 11-20 are no longer blurred for free users; they remain visible.
    // However, free users cannot use "Add to Quiz", "Mark Known", or "Ask for help" on words 11-20.
    const wordsWithSentences = (words || []).map((word, index) => {
      const position = word.position ?? (index + 1)
      
      return {
        ...word,
        position,
        sentences: (sentences || []).filter((s) => s.word_id === word.id),
      }
    })

    return NextResponse.json({
      island,
      words: wordsWithSentences,
      grammarFocus: grammarFocusWithExamples,
      user_plan: entitlements.isPro ? 'pro' : 'free',
      user_cefr_level: userProfile?.cefr_level ?? null,
      is_anonymous: user?.is_anonymous ?? false,
      user_topic_island_count: topicIslandCount ?? 0,
      can_create_topic_island: createIslandEligibility.allowed,
      journeyContext,
    })
  } catch (error) {
    console.error('Error in GET /api/topic-islands/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/topic-islands/[id]
 * Update island properties (e.g., topic name)
 */
export async function PATCH(
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

    const islandId = params.id
    const body = await request.json()
    const { topic } = body

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return NextResponse.json(
        { error: 'Topic is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    // Verify ownership and update
    const { data: island, error: updateError } = await supabase
      .from('topic_islands')
      .update({ topic: topic.trim() })
      .eq('id', islandId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError || !island) {
      return NextResponse.json(
        { error: 'Island not found or access denied' },
        { status: 404 }
      )
    }

    return NextResponse.json({ island })
  } catch (error) {
    console.error('Error in PATCH /api/topic-islands/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/topic-islands/[id]
 * Delete an island and all associated words/sentences
 * CASCADE delete in database handles related records automatically
 */
export async function DELETE(
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

    const islandId = params.id

    // Verify ownership
    const { data: island, error: islandError } = await supabase
      .from('topic_islands')
      .select('id')
      .eq('id', islandId)
      .eq('user_id', user.id)
      .single()

    if (islandError || !island) {
      return NextResponse.json(
        { error: 'Island not found or access denied' },
        { status: 404 }
      )
    }

    // Delete island (CASCADE will delete words and sentences automatically)
    const { error: deleteError } = await supabase
      .from('topic_islands')
      .delete()
      .eq('id', islandId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting island:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete island' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/topic-islands/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
