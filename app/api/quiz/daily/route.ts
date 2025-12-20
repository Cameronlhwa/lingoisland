import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/quiz/daily?deckId=...
 * Get 10-20 cards due for review (or fallback to recent created)
 * Optional deckId filter
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const deckId = searchParams.get('deckId')

    // If deckId provided, verify it belongs to user
    if (deckId) {
      const { data: deck } = await supabase
        .from('decks')
        .select('id')
        .eq('id', deckId)
        .eq('user_id', user.id)
        .single()

      if (!deck) {
        return NextResponse.json(
          { error: 'Deck not found or access denied' },
          { status: 404 }
        )
      }
    }

    // Build query for due cards
    // First get card IDs that match the deck filter
    let cardIdsQuery = supabase
      .from('flashcards')
      .select('id')
      .eq('user_id', user.id)

    if (deckId) {
      cardIdsQuery = cardIdsQuery.eq('deck_id', deckId)
    }

    const { data: matchingCards } = await cardIdsQuery
    const matchingCardIds = (matchingCards || []).map((c) => c.id)

    if (matchingCardIds.length === 0) {
      // No cards match, return empty
      return NextResponse.json({ cards: [] })
    }

    // Now get review states for these cards
    const { data: reviewStates, error } = await supabase
      .from('card_review_state')
      .select(`
        *,
        card:flashcards(*)
      `)
      .eq('user_id', user.id)
      .in('card_id', matchingCardIds)
      .lte('due_at', new Date().toISOString())
      .order('due_at', { ascending: true })
      .limit(20)

    if (error) {
      console.error('Error fetching due cards:', error)
      return NextResponse.json(
        { error: 'Failed to fetch cards' },
        { status: 500 }
      )
    }

    // If we have due cards, return them
    if (reviewStates && reviewStates.length > 0) {
      const cards = reviewStates
        .filter((rs) => rs.card) // Filter out any null cards
        .map((rs) => ({
          ...rs.card,
          reviewState: {
            id: rs.id,
            ease: rs.ease,
            intervalDays: rs.interval_days,
            dueAt: rs.due_at,
            lastReviewedAt: rs.last_reviewed_at,
          },
        }))
        .slice(0, 20) // Limit to 20

      return NextResponse.json({ cards })
    }

    // Fallback: get recent cards (created in last 7 days, not yet reviewed)
    let fallbackQuery = supabase
      .from('flashcards')
      .select(`
        *,
        reviewState:card_review_state(*)
      `)
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20)

    if (deckId) {
      fallbackQuery = fallbackQuery.eq('deck_id', deckId)
    }

    const { data: recentCards, error: fallbackError } = await fallbackQuery

    if (fallbackError) {
      console.error('Error fetching recent cards:', fallbackError)
      return NextResponse.json(
        { error: 'Failed to fetch cards' },
        { status: 500 }
      )
    }

    const cards = (recentCards || []).map((card) => ({
      ...card,
      reviewState: card.reviewState?.[0] || null,
    }))

    return NextResponse.json({ cards })
  } catch (error) {
    console.error('Error in GET /api/quiz/daily:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

