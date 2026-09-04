import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/quiz-islands
 * List all quiz islands for the authenticated user with card counts
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get quiz islands (Islands tree only — HSK Flashcards decks live in
    // /api/hsk/flashcard-decks and are scoped out via origin)
    const { data: islands, error: islandsError } = await supabase
      .from('quiz_islands')
      .select('*')
      .eq('user_id', user.id)
      .eq('origin', 'islands')
      .order('created_at', { ascending: false })

    if (islandsError) {
      console.error('Error fetching quiz islands:', islandsError)
      return NextResponse.json(
        { error: 'Failed to fetch quiz islands' },
        { status: 500 }
      )
    }

    if (!islands || islands.length === 0) {
      return NextResponse.json({ quizIslands: [] })
    }

    // Get card counts efficiently using aggregation
    const islandIds = islands.map((island) => island.id)
    const { data: cardCounts, error: cardsError } = await supabase
      .from('card_collections')
      .select('collection_id')
      .eq('user_id', user.id)
      .eq('collection_type', 'quiz_island')
      .in('collection_id', islandIds)

    if (cardsError) {
      console.error('Error fetching card counts:', cardsError)
      return NextResponse.json(
        { error: 'Failed to fetch card counts' },
        { status: 500 }
      )
    }

    // Count cards per island
    const countsMap = new Map<string, number>()
    for (const card of cardCounts || []) {
      countsMap.set(
        card.collection_id,
        (countsMap.get(card.collection_id) || 0) + 1
      )
    }

    // Attach card counts to islands
    const islandsWithCounts = islands.map((island) => ({
      ...island,
      card_count: countsMap.get(island.id) || 0,
    }))

    return NextResponse.json({ quizIslands: islandsWithCounts })
  } catch (error) {
    console.error('Error in GET /api/quiz-islands:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/quiz-islands
 * Create a new quiz island
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
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Quiz island name is required' },
        { status: 400 }
      )
    }

    const { data: quizIsland, error } = await supabase
      .from('quiz_islands')
      .insert({
        user_id: user.id,
        name: name.trim(),
        origin: 'islands',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating quiz island:', error)
      return NextResponse.json(
        { error: 'Failed to create quiz island' },
        { status: 500 }
      )
    }

    return NextResponse.json({ quizIsland })
  } catch (error) {
    console.error('Error in POST /api/quiz-islands:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/quiz-islands
 * Delete a quiz island
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const quizIslandId = searchParams.get('quizIslandId')

    if (!quizIslandId) {
      return NextResponse.json(
        { error: 'Quiz island ID is required' },
        { status: 400 }
      )
    }

    // Delete the quiz island
    const { error } = await supabase
      .from('quiz_islands')
      .delete()
      .eq('id', quizIslandId)
      .eq('user_id', user.id)
      .eq('origin', 'islands')

    if (error) {
      console.error('Error deleting quiz island:', error)
      return NextResponse.json(
        { error: 'Failed to delete quiz island' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/quiz-islands:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

