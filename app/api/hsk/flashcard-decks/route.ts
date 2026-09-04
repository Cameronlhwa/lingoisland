import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { denyWithoutProductAccess } from '@/lib/product-access'

/**
 * HSK Flashcards' own deck-listing tree — forked from /api/quiz-islands
 * rather than sharing it, so schema/behavior changes on one side (paywall
 * rules, validation, response shape) can't silently affect the other.
 * Decks are still stored in the shared `quiz_islands` table but scoped by
 * `origin = 'hsk'`, keeping the two lists from bleeding into each other.
 */

/**
 * GET /api/hsk/flashcard-decks
 * List the signed-in user's HSK flashcard decks with card counts.
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
    const denial = await denyWithoutProductAccess(user.id, 'hsk')
    if (denial) return denial

    const { data: decks, error: decksError } = await supabase
      .from('quiz_islands')
      .select('*')
      .eq('user_id', user.id)
      .eq('origin', 'hsk')
      .order('created_at', { ascending: false })

    if (decksError) {
      console.error('Error fetching HSK flashcard decks:', decksError)
      return NextResponse.json(
        { error: 'Failed to fetch flashcard decks' },
        { status: 500 }
      )
    }

    const emptySummary = { totalCards: 0, mastered: 0, due: 0, new: 0 }

    if (!decks || decks.length === 0) {
      return NextResponse.json({ decks: [], summary: emptySummary })
    }

    const deckIds = decks.map((deck) => deck.id)
    const { data: cardCollections, error: cardsError } = await supabase
      .from('card_collections')
      .select('collection_id, card_id')
      .eq('user_id', user.id)
      .eq('collection_type', 'quiz_island')
      .in('collection_id', deckIds)

    if (cardsError) {
      console.error('Error fetching card counts:', cardsError)
      return NextResponse.json(
        { error: 'Failed to fetch card counts' },
        { status: 500 }
      )
    }

    const countsMap = new Map<string, number>()
    for (const row of cardCollections || []) {
      countsMap.set(row.collection_id, (countsMap.get(row.collection_id) || 0) + 1)
    }

    const decksWithCounts = decks.map((deck) => ({
      ...deck,
      card_count: countsMap.get(deck.id) || 0,
    }))

    // Aggregate mastered / due / new across every HSK deck for the ring chart.
    const cardIds = (cardCollections || []).map((row) => row.card_id)
    let summary = { ...emptySummary, totalCards: cardIds.length }

    if (cardIds.length > 0) {
      const { data: reviewStates, error: reviewError } = await supabase
        .from('card_review_state')
        .select('card_id, due_at, mastery_tier')
        .eq('user_id', user.id)
        .in('card_id', cardIds)

      if (reviewError) {
        console.error('Error fetching review states for summary:', reviewError)
      } else {
        const stateByCardId = new Map((reviewStates || []).map((r) => [r.card_id, r]))
        const now = Date.now()
        let mastered = 0
        let due = 0
        for (const cardId of cardIds) {
          const state = stateByCardId.get(cardId)
          if (state?.due_at && new Date(state.due_at).getTime() <= now) {
            due += 1
          } else if (state?.mastery_tier === 'easy') {
            mastered += 1
          }
        }
        summary = {
          totalCards: cardIds.length,
          mastered,
          due,
          new: cardIds.length - mastered - due,
        }
      }
    }

    return NextResponse.json({ decks: decksWithCounts, summary })
  } catch (error) {
    console.error('Error in GET /api/hsk/flashcard-decks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/hsk/flashcard-decks
 * Create a new HSK flashcard deck.
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
    const denial = await denyWithoutProductAccess(user.id, 'hsk')
    if (denial) return denial

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Deck name is required' }, { status: 400 })
    }

    const { data: deck, error } = await supabase
      .from('quiz_islands')
      .insert({
        user_id: user.id,
        name: name.trim(),
        origin: 'hsk',
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating HSK flashcard deck:', error)
      return NextResponse.json({ error: 'Failed to create deck' }, { status: 500 })
    }

    return NextResponse.json({ deck })
  } catch (error) {
    console.error('Error in POST /api/hsk/flashcard-decks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/hsk/flashcard-decks?deckId=...
 * Delete an HSK flashcard deck.
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
    const denial = await denyWithoutProductAccess(user.id, 'hsk')
    if (denial) return denial

    const { searchParams } = new URL(request.url)
    const deckId = searchParams.get('deckId')

    if (!deckId) {
      return NextResponse.json({ error: 'Deck ID is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('quiz_islands')
      .delete()
      .eq('id', deckId)
      .eq('user_id', user.id)
      .eq('origin', 'hsk')

    if (error) {
      console.error('Error deleting HSK flashcard deck:', error)
      return NextResponse.json({ error: 'Failed to delete deck' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/hsk/flashcard-decks:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
