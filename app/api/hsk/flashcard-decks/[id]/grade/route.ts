import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { incrementHuahua } from '@/lib/huahua'
import { denyWithoutProductAccess } from '@/lib/product-access'

/**
 * POST /api/hsk/flashcard-decks/[id]/grade
 * Grade a card (forgot/hard/good/easy). Reuses the shared grade_card RPC
 * (generic SRS infrastructure) but keeps its own ownership check and
 * response shaping independent of /api/quiz-islands/[id]/grade.
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
    const denial = await denyWithoutProductAccess(user.id, 'hsk')
    if (denial) return denial

    const { data: deck } = await supabase
      .from('quiz_islands')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .eq('origin', 'hsk')
      .single()

    if (!deck) {
      return NextResponse.json({ error: 'Deck not found or access denied' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const { cardId, rating } = body

    if (!cardId || typeof cardId !== 'string') {
      return NextResponse.json({ error: 'Card ID is required' }, { status: 400 })
    }

    if (!['forgot', 'hard', 'good', 'easy'].includes(rating)) {
      return NextResponse.json(
        { error: 'Rating must be forgot, hard, good, or easy' },
        { status: 400 }
      )
    }

    const { data: cardRow } = await supabase
      .from('cards')
      .select('source_type, source_ref_id')
      .eq('id', cardId)
      .maybeSingle()

    const { data, error } = await supabase.rpc('grade_card', {
      p_card_id: cardId,
      p_rating: rating,
    })

    if (error) {
      console.error('Error grading card:', error)
      return NextResponse.json({ error: 'Failed to grade card' }, { status: 500 })
    }

    // Mark the source HSK word as effectively "learned" isn't tracked on a
    // separate table (status is derived live from cards/card_review_state —
    // see app/api/hsk/words/route.ts), so unlike the Islands grade route
    // there's no island_words sync needed here.
    void cardRow

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
    console.error('Error in POST /api/hsk/flashcard-decks/[id]/grade:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
