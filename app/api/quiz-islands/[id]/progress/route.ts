import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/quiz-islands/[id]/progress?tier=easy
 * Get cards with their mastery level for progress view
 * Optional tier filter: easy, good, hard, relearning, new
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

    // Verify quiz island belongs to user
    const { data: quizIsland } = await supabase
      .from('quiz_islands')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .eq('origin', 'islands')
      .single()

    if (!quizIsland) {
      return NextResponse.json(
        { error: 'Quiz island not found or access denied' },
        { status: 404 }
      )
    }

    const { searchParams } = new URL(request.url)
    const tierFilter = searchParams.get('tier') // easy, good, hard, relearning, new

    // Get all cards for this quiz island with their review state
    let query = supabase
      .from('card_collections')
      .select(`
        card_id,
        cards!inner (
          id,
          front,
          back,
          pinyin,
          front_lang,
          back_lang
        )
      `)
      .eq('collection_type', 'quiz_island')
      .eq('collection_id', params.id)
      .eq('user_id', user.id)

    const { data: collections, error: collectionsError } = await query

    if (collectionsError) {
      console.error('Error fetching cards:', collectionsError)
      return NextResponse.json(
        { error: 'Failed to fetch cards' },
        { status: 500 }
      )
    }

    // Extract card IDs
    const cardIds = (collections || []).map((c: any) => c.card_id)

    if (cardIds.length === 0) {
      return NextResponse.json({ cards: [] })
    }

    // Get review states for these cards
    const { data: reviewStates, error: reviewError } = await supabase
      .from('card_review_state')
      .select('*')
      .eq('user_id', user.id)
      .in('card_id', cardIds)

    if (reviewError) {
      console.error('Error fetching review states:', reviewError)
      return NextResponse.json(
        { error: 'Failed to fetch review states' },
        { status: 500 }
      )
    }

    // Build review state map
    const reviewStateMap = new Map()
    for (const rs of reviewStates || []) {
      reviewStateMap.set(rs.card_id, rs)
    }

    // Combine cards with their review state and filter by tier
    const cardsWithState = (collections || [])
      .map((c: any) => {
        const card = c.cards
        const reviewState = reviewStateMap.get(card.id)
        const masteryTier = reviewState?.mastery_tier || 'new'

        return {
          id: card.id,
          front: card.front,
          back: card.back,
          pinyin: card.pinyin,
          front_lang: card.front_lang,
          back_lang: card.back_lang,
          mastery_tier: masteryTier,
          interval_days: reviewState?.interval_days || 0,
          ease: reviewState?.ease || 2.5,
          streak: reviewState?.streak || 0,
          lapses: reviewState?.lapses || 0,
          last_reviewed_at: reviewState?.last_reviewed_at || null,
          due_at: reviewState?.due_at || null,
        }
      })
      .filter((card: any) => {
        if (!tierFilter) return true
        return card.mastery_tier === tierFilter
      })
      .sort((a: any, b: any) => {
        // Sort by mastery tier, then alphabetically by front
        const tierOrder: Record<string, number> = {
          relearning: 1,
          hard: 2,
          good: 3,
          easy: 4,
          new: 5,
        }
        const tierDiff = (tierOrder[a.mastery_tier] || 9) - (tierOrder[b.mastery_tier] || 9)
        if (tierDiff !== 0) return tierDiff
        return a.front.localeCompare(b.front)
      })

    return NextResponse.json({ cards: cardsWithState })
  } catch (error) {
    console.error('Error in GET /api/quiz-islands/[id]/progress:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
