import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/quiz-islands/[id]
 * Get a single quiz island with card count
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

    const { data: quizIsland, error } = await supabase
      .from('quiz_islands')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .eq('origin', 'islands')
      .single()

    if (error || !quizIsland) {
      return NextResponse.json(
        { error: 'Quiz island not found' },
        { status: 404 }
      )
    }

    // Get card count
    const { count, error: countError } = await supabase
      .from('card_collections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('collection_type', 'quiz_island')
      .eq('collection_id', params.id)

    if (countError) {
      console.error('Error counting cards:', countError)
    }

    return NextResponse.json({
      quizIsland: {
        ...quizIsland,
        card_count: count || 0,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/quiz-islands/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/quiz-islands/[id]
 * Update quiz island properties (e.g., name)
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

    const quizIslandId = params.id
    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    // Verify ownership and update
    const { data: quizIsland, error: updateError } = await supabase
      .from('quiz_islands')
      .update({ name: name.trim() })
      .eq('id', quizIslandId)
      .eq('user_id', user.id)
      .eq('origin', 'islands')
      .select()
      .single()

    if (updateError || !quizIsland) {
      return NextResponse.json(
        { error: 'Quiz island not found or access denied' },
        { status: 404 }
      )
    }

    return NextResponse.json({ quizIsland })
  } catch (error) {
    console.error('Error in PATCH /api/quiz-islands/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

