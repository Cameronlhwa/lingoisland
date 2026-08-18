import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { canCreateTopicIsland, incrementTopicIslandCount } from '@/lib/entitlements'
import { pickRandomCoverKey } from '@/lib/islandLibrary'
import { normalizeSentenceStyle } from '@/lib/sentenceStyle'
import { topicIslandsHasSentenceStyleColumn } from '@/lib/supabase/schemaFeatures'

/**
 * POST /api/topic-islands
 * Create a new topic island
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Ensure user_profiles and profiles exist (e.g. for anonymous users who skip OAuth callback)
    const [userProfileRes, profileRes] = await Promise.all([
      supabase.from('user_profiles').select('user_id').eq('user_id', user.id).maybeSingle(),
      supabase.from('profiles').select('id').eq('id', user.id).maybeSingle(),
    ])
    if (!userProfileRes.data) {
      await supabase.from('user_profiles').insert({ user_id: user.id, cefr_level: 'B1' })
    }
    if (!profileRes.data) {
      await supabase.from('profiles').insert({ id: user.id, plan: 'free' })
    }

    // Check if user can create a topic island (Free: 1/month, Pro: unlimited)
    const { allowed, reason } = await canCreateTopicIsland(user.id)
    if (!allowed) {
      return NextResponse.json(
        { 
          error: reason || 'Cannot create topic island',
          code: 'PAYWALL_ISLAND_LIMIT'
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { topic, level, wordTarget, grammarTarget, sentenceStyle } = body

    // Validate input
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      )
    }

    // Allow fine-grained CEFR values like A1-, A1, A1+, A2-, A2, A2+, B1-, B1, B1+, B2-, B2, B2+, C1-, C1, C1+
    // Validate that they belong to one of the standard CEFR bands
    if (!level || typeof level !== 'string') {
      return NextResponse.json(
        { error: 'Level is required' },
        { status: 400 }
      )
    }

    const baseLevel =
      level.startsWith('A0') ? 'A0' :
      level.startsWith('A1') ? 'A1' :
      level.startsWith('A2') ? 'A2' : 
      level.startsWith('B1') ? 'B1' : 
      level.startsWith('B2') ? 'B2' :
      level.startsWith('C1') ? 'C1' : null

    if (!baseLevel) {
      return NextResponse.json(
        { error: 'Level must be in the A0, A1, A2, B1, B2, or C1 bands' },
        { status: 400 }
      )
    }

    if (
      !wordTarget ||
      typeof wordTarget !== 'number' ||
      wordTarget < 5 ||
      wordTarget > 20
    ) {
      return NextResponse.json(
        { error: 'wordTarget must be between 5 and 20' },
        { status: 400 }
      )
    }

    // grammarTarget is optional, but if provided must be 0-3
    const grammar = grammarTarget != null ? grammarTarget : 0
    if (typeof grammar !== 'number' || grammar < 0 || grammar > 3) {
      return NextResponse.json(
        { error: 'grammarTarget must be between 0 and 3' },
        { status: 400 }
      )
    }

    const trimmedTopic = topic.trim()
    const normalizedSentenceStyle = normalizeSentenceStyle(sentenceStyle)

    // Idempotency: if an island with the same topic already exists for this user,
    // reuse it instead of creating a duplicate.
    const { data: existingIslands, error: existingError } = await supabase
      .from('topic_islands')
      .select('*')
      .eq('user_id', user.id)
      .ilike('topic', trimmedTopic)
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingError) {
      console.error('Error checking existing topic islands:', existingError)
    }

    const existing = existingIslands && existingIslands.length > 0 ? existingIslands[0] : null

    if (existing) {
      // Return existing island id to keep behaviour consistent
      // Don't increment usage count since island already exists
      return NextResponse.json({
        islandId: existing.id,
        sentenceStyle: normalizeSentenceStyle(
          existing.sentence_style ?? normalizedSentenceStyle,
        ),
      })
    }

    // Create topic island with pre-generated cover image
    const insertRow: Record<string, unknown> = {
      user_id: user.id,
      topic: trimmedTopic,
      // Store the full level string (e.g. "A2-" or "B1+")
      level,
      word_target: wordTarget,
      grammar_target: grammar,
      status: 'draft',
      cover_key: pickRandomCoverKey(), // Assign random pre-generated island image
    }

    if (await topicIslandsHasSentenceStyleColumn(supabase)) {
      insertRow.sentence_style = normalizedSentenceStyle
    }

    const { data: island, error } = await supabase
      .from('topic_islands')
      .insert(insertRow)
      .select()
      .single()

    if (error) {
      console.error('Error creating topic island:', error)
      return NextResponse.json(
        { 
          error: 'Failed to create topic island',
          details: error.message || 'Unknown error'
        },
        { status: 500 }
      )
    }

    // Increment usage count for this month
    await incrementTopicIslandCount(user.id)

    return NextResponse.json({
      islandId: island.id,
      sentenceStyle: normalizedSentenceStyle,
    })
  } catch (error) {
    console.error('Error in POST /api/topic-islands:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

