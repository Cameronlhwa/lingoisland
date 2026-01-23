import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/quiz-islands/[id]/grade
 * Grade a card (forgot/hard/good/easy)
 */
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

    // Verify quiz island belongs to user
    const { data: quizIsland } = await supabase
      .from('quiz_islands')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!quizIsland) {
      return NextResponse.json(
        { error: 'Quiz island not found or access denied' },
        { status: 404 }
      )
    }

    const body = await request.json()
    const { cardId, rating } = body

    if (!cardId || typeof cardId !== 'string') {
      return NextResponse.json(
        { error: 'Card ID is required' },
        { status: 400 }
      )
    }

    if (!['forgot', 'hard', 'good', 'easy'].includes(rating)) {
      return NextResponse.json(
        { error: 'Rating must be forgot, hard, good, or easy' },
        { status: 400 }
      )
    }

    // Call the RPC function
    const { data, error } = await supabase.rpc('grade_card', {
      p_card_id: cardId,
      p_rating: rating,
    })

    if (error) {
      console.error('Error grading card:', error)
      return NextResponse.json(
        { error: 'Failed to grade card' },
        { status: 500 }
      )
    }

    const { error: activityError } = await supabase
      .from('quiz_activity_events')
      .insert({
        user_id: user.id,
        card_id: cardId,
        reviewed_at: new Date().toISOString(),
      })

    if (activityError) {
      console.error('Error logging quiz activity:', activityError)
    }

    return NextResponse.json({ success: true, reviewState: data })
  } catch (error) {
    console.error('Error in POST /api/quiz-islands/[id]/grade:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

