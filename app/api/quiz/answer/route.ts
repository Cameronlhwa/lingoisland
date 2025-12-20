import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/quiz/answer
 * Update card review state based on user rating
 * Simple SRS algorithm:
 * - again: interval=1, ease=max(1.3,ease-0.2), due=tomorrow
 * - hard: interval=max(1, round(interval*1.5)), ease=max(1.3,ease-0.05)
 * - good: interval=max(1, round(interval*ease)), ease=min(2.8,ease+0.05)
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
    const { cardId, rating } = body

    if (!cardId || typeof cardId !== 'string') {
      return NextResponse.json(
        { error: 'Card ID is required' },
        { status: 400 }
      )
    }

    if (!['again', 'hard', 'good'].includes(rating)) {
      return NextResponse.json(
        { error: 'Rating must be "again", "hard", or "good"' },
        { status: 400 }
      )
    }

    // Get current review state
    const { data: reviewState, error: fetchError } = await supabase
      .from('card_review_state')
      .select('*')
      .eq('card_id', cardId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !reviewState) {
      return NextResponse.json(
        { error: 'Review state not found' },
        { status: 404 }
      )
    }

    // Verify card belongs to user
    const { data: card } = await supabase
      .from('flashcards')
      .select('id')
      .eq('id', cardId)
      .eq('user_id', user.id)
      .single()

    if (!card) {
      return NextResponse.json(
        { error: 'Card not found or access denied' },
        { status: 404 }
      )
    }

    // Calculate new values based on rating
    let newEase = reviewState.ease
    let newInterval = reviewState.interval_days
    const now = new Date()

    if (rating === 'again') {
      newEase = Math.max(1.3, reviewState.ease - 0.2)
      newInterval = 1
    } else if (rating === 'hard') {
      newEase = Math.max(1.3, reviewState.ease - 0.05)
      newInterval = Math.max(1, Math.round(reviewState.interval_days * 1.5))
    } else if (rating === 'good') {
      newEase = Math.min(2.8, reviewState.ease + 0.05)
      newInterval = Math.max(1, Math.round(reviewState.interval_days * reviewState.ease))
    }

    // Calculate new due date
    const dueAt = new Date(now)
    dueAt.setDate(dueAt.getDate() + newInterval)

    // Update review state
    const { data: updatedState, error: updateError } = await supabase
      .from('card_review_state')
      .update({
        ease: newEase,
        interval_days: newInterval,
        due_at: dueAt.toISOString(),
        last_reviewed_at: now.toISOString(),
      })
      .eq('id', reviewState.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating review state:', updateError)
      return NextResponse.json(
        { error: 'Failed to update review state' },
        { status: 500 }
      )
    }

    return NextResponse.json({ reviewState: updatedState })
  } catch (error) {
    console.error('Error in POST /api/quiz/answer:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

