import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

    // Get words
    const { data: words } = await supabase
      .from('island_words')
      .select('*')
      .eq('island_id', islandId)
      .order('created_at', { ascending: true })

    // Get sentences grouped by word
    const { data: sentences } = await supabase
      .from('island_sentences')
      .select('*')
      .eq('island_id', islandId)
      .order('word_id, tier', { ascending: true })

    // Attach sentences to words
    const wordsWithSentences = (words || []).map((word) => ({
      ...word,
      sentences: (sentences || []).filter((s) => s.word_id === word.id),
    }))

    return NextResponse.json({
      island,
      words: wordsWithSentences,
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
