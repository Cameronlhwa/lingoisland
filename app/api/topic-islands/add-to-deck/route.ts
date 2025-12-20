import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/topic-islands/add-to-deck
 * Add a word or sentence from a topic island to a deck
 * Creates two cards: hanzi->english and english->hanzi
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
    const { deckId, type, sourceId } = body

    if (!deckId || typeof deckId !== 'string') {
      return NextResponse.json(
        { error: 'Deck ID is required' },
        { status: 400 }
      )
    }

    if (!['word', 'sentence'].includes(type)) {
      return NextResponse.json(
        { error: 'Type must be "word" or "sentence"' },
        { status: 400 }
      )
    }

    if (!sourceId || typeof sourceId !== 'string') {
      return NextResponse.json(
        { error: 'Source ID is required' },
        { status: 400 }
      )
    }

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

    // Fetch the word or sentence
    let hanzi: string
    let pinyin: string
    let english: string
    let sourceType: string

    if (type === 'word') {
      const { data: word } = await supabase
        .from('island_words')
        .select('hanzi, pinyin, english')
        .eq('id', sourceId)
        .eq('user_id', user.id)
        .single()

      if (!word) {
        return NextResponse.json(
          { error: 'Word not found or access denied' },
          { status: 404 }
        )
      }

      hanzi = word.hanzi
      pinyin = word.pinyin
      english = word.english
      sourceType = 'topic_island_word'
    } else {
      const { data: sentence } = await supabase
        .from('island_sentences')
        .select('hanzi, pinyin, english')
        .eq('id', sourceId)
        .eq('user_id', user.id)
        .single()

      if (!sentence) {
        return NextResponse.json(
          { error: 'Sentence not found or access denied' },
          { status: 404 }
        )
      }

      hanzi = sentence.hanzi
      pinyin = sentence.pinyin
      english = sentence.english
      sourceType = 'topic_island_sentence'
    }

    // Check for duplicates before inserting
    const { data: existingCards } = await supabase
      .from('flashcards')
      .select('id')
      .eq('deck_id', deckId)
      .eq('user_id', user.id)
      .eq('source', sourceType)
      .eq('source_ref_id', sourceId)
      .limit(1)

    if (existingCards && existingCards.length > 0) {
      // Cards already exist, return existing IDs
      return NextResponse.json({
        message: 'Cards already exist in this deck',
        cardIds: existingCards.map((c) => c.id),
      })
    }

    // Create two cards
    const cardsToInsert = [
      {
        user_id: user.id,
        deck_id: deckId,
        front: hanzi,
        back: english,
        front_lang: 'zh',
        back_lang: 'en',
        pinyin: pinyin,
        source: sourceType,
        source_ref_id: sourceId,
      },
      {
        user_id: user.id,
        deck_id: deckId,
        front: english,
        back: hanzi,
        front_lang: 'en',
        back_lang: 'zh',
        pinyin: null, // English side doesn't need pinyin
        source: sourceType,
        source_ref_id: sourceId,
      },
    ]

    const { data: cards, error: cardsError } = await supabase
      .from('flashcards')
      .insert(cardsToInsert)
      .select()

    if (cardsError) {
      console.error('Error creating cards:', cardsError)
      return NextResponse.json(
        { error: 'Failed to create cards' },
        { status: 500 }
      )
    }

    // Create review states for both cards (due now)
    const reviewStates = (cards || []).map((card) => ({
      user_id: user.id,
      card_id: card.id,
      ease: 2.5,
      interval_days: 1,
      due_at: new Date().toISOString(),
    }))

    const { error: reviewError } = await supabase
      .from('card_review_state')
      .insert(reviewStates)

    if (reviewError) {
      console.error('Error creating review states:', reviewError)
      // Cards were created, so we'll continue but log the error
    }

    return NextResponse.json({
      message: 'Cards created successfully',
      cardIds: (cards || []).map((c) => c.id),
    })
  } catch (error) {
    console.error('Error in POST /api/topic-islands/add-to-deck:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

