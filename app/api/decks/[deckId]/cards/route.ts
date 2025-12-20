import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/decks/[deckId]/cards
 * List all cards in a deck
 */
export async function GET(
  request: Request,
  { params }: { params: { deckId: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const deckId = params.deckId

    // Verify deck belongs to user
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

    const { data: cards, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('deck_id', deckId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching cards:', error)
      return NextResponse.json(
        { error: 'Failed to fetch cards' },
        { status: 500 }
      )
    }

    return NextResponse.json({ cards: cards || [] })
  } catch (error) {
    console.error('Error in GET /api/decks/[deckId]/cards:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/decks/[deckId]/cards
 * Create a new manual card
 */
export async function POST(
  request: Request,
  { params }: { params: { deckId: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const deckId = params.deckId

    // Verify deck belongs to user
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

    const body = await request.json()
    const { front, back, pinyin, frontLang, backLang } = body

    if (!front || typeof front !== 'string' || front.trim().length === 0) {
      return NextResponse.json(
        { error: 'Front text is required' },
        { status: 400 }
      )
    }

    if (!back || typeof back !== 'string' || back.trim().length === 0) {
      return NextResponse.json(
        { error: 'Back text is required' },
        { status: 400 }
      )
    }

    // Create card
    const { data: card, error: cardError } = await supabase
      .from('flashcards')
      .insert({
        user_id: user.id,
        deck_id: deckId,
        front: front.trim(),
        back: back.trim(),
        pinyin: pinyin?.trim() || null,
        front_lang: frontLang || 'zh',
        back_lang: backLang || 'en',
        source: 'manual',
      })
      .select()
      .single()

    if (cardError) {
      console.error('Error creating card:', cardError)
      return NextResponse.json(
        { error: 'Failed to create card' },
        { status: 500 }
      )
    }

    // Create review state (due now)
    const { error: reviewError } = await supabase
      .from('card_review_state')
      .insert({
        user_id: user.id,
        card_id: card.id,
        ease: 2.5,
        interval_days: 1,
        due_at: new Date().toISOString(),
      })

    if (reviewError) {
      console.error('Error creating review state:', reviewError)
      // Card was created, so we'll continue but log the error
    }

    return NextResponse.json({ card })
  } catch (error) {
    console.error('Error in POST /api/decks/[deckId]/cards:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

