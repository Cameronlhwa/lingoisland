import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

    const body = await request.json()
    const { topic, level, wordTarget, grammarTarget } = body

    // Validate input
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      )
    }

    // Allow fine-grained CEFR values like A2-, A2, A2+, B1-, B1, B1+, B2-, B2, B2+,
    // but require that they belong to one of the A2/B1/B2 bands.
    if (!level || typeof level !== 'string') {
      return NextResponse.json(
        { error: 'Level is required' },
        { status: 400 }
      )
    }

    const baseLevel =
      level.startsWith('A2') ? 'A2' : level.startsWith('B1') ? 'B1' : level.startsWith('B2') ? 'B2' : null

    if (!baseLevel) {
      return NextResponse.json(
        { error: 'Level must be in the A2, B1, or B2 bands' },
        { status: 400 }
      )
    }

    if (
      !wordTarget ||
      typeof wordTarget !== 'number' ||
      wordTarget < 10 ||
      wordTarget > 20
    ) {
      return NextResponse.json(
        { error: 'wordTarget must be between 10 and 20' },
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
      return NextResponse.json({ islandId: existing.id })
    }

    // Create topic island
    const { data: island, error } = await supabase
      .from('topic_islands')
      .insert({
        user_id: user.id,
        topic: trimmedTopic,
        // Store the full level string (e.g. "A2-" or "B1+")
        level,
        word_target: wordTarget,
        grammar_target: grammar,
        status: 'draft',
      })
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

    return NextResponse.json({ islandId: island.id })
  } catch (error) {
    console.error('Error in POST /api/topic-islands:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

