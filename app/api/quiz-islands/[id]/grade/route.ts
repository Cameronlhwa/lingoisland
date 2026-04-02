import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { incrementHuahua } from '@/lib/huahua'

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

    const body = await request.json().catch(() => ({}))
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

    // Fetch card source before grading so we can mark the island word as learned
    const { data: cardRow } = await supabase
      .from('cards')
      .select('source_type, source_ref_id')
      .eq('id', cardId)
      .maybeSingle()

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

    // Mark the source island word as learned on the first good/easy grade
    if (
      (rating === 'good' || rating === 'easy') &&
      cardRow?.source_type === 'topic_word' &&
      cardRow?.source_ref_id
    ) {
      const { error: learnedErr } = await supabase
        .from('island_words')
        .update({ learned_at: new Date().toISOString() })
        .eq('id', cardRow.source_ref_id)
        .is('learned_at', null)
      if (learnedErr) {
        console.error('Error setting learned_at on island word:', learnedErr)
      }
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

    const { huahuaReviewsToday, huahuaStage } = await incrementHuahua(supabase, user.id, 1)

    return NextResponse.json({
      success: true,
      reviewState: data,
      todayCount: huahuaReviewsToday,
      huahuaTotalReviews: huahuaReviewsToday,
      huahuaStage,
    })
  } catch (error) {
    console.error('Error in POST /api/quiz-islands/[id]/grade:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
