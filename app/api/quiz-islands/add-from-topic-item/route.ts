import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * POST /api/quiz-islands/add-from-topic-item
 * Add a word or sentence from a topic island to a quiz island
 * For words: creates both ZH_EN and EN_ZH (if requested)
 * For sentences: creates only ZH_EN
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
    const { quizIslandId, type, sourceId, createReverse } = body

    if (!quizIslandId || typeof quizIslandId !== 'string') {
      return NextResponse.json(
        { error: 'Quiz island ID is required' },
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

    // Verify quiz island belongs to user
    const { data: quizIsland } = await supabase
      .from('quiz_islands')
      .select('id')
      .eq('id', quizIslandId)
      .eq('user_id', user.id)
      .single()

    if (!quizIsland) {
      return NextResponse.json(
        { error: 'Quiz island not found or access denied' },
        { status: 404 }
      )
    }

    // Fetch the word or sentence
    let hanzi: string
    let pinyin: string
    let english: string

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
    }

    // Check for existing cards (using unique constraint on source_topic_item_id)
    const { data: existingCards } = await supabase
      .from('quiz_cards')
      .select('id, direction')
      .eq('quiz_island_id', quizIslandId)
      .eq('user_id', user.id)
      .eq('source_topic_item_id', sourceId)

    // Determine which cards to create
    const cardsToCreate = []
    const shouldCreateReverse = type === 'word' && (createReverse !== false) // Default true for words

    // Always create ZH_EN for both words and sentences
    const hasZH_EN = existingCards?.some((c) => c.direction === 'ZH_EN')
    if (!hasZH_EN) {
      cardsToCreate.push({
        user_id: user.id,
        quiz_island_id: quizIslandId,
        direction: 'ZH_EN',
        front: hanzi,
        back: english,
        pinyin: pinyin,
        source_topic_item_id: sourceId,
      })
    }

    // Create EN_ZH only for words (if requested)
    if (shouldCreateReverse) {
      const hasEN_ZH = existingCards?.some((c) => c.direction === 'EN_ZH')
      if (!hasEN_ZH) {
        cardsToCreate.push({
          user_id: user.id,
          quiz_island_id: quizIslandId,
          direction: 'EN_ZH',
          front: english,
          back: hanzi,
          pinyin: null,
          source_topic_item_id: sourceId,
        })
      }
    }

    if (cardsToCreate.length === 0) {
      // Cards already exist
      return NextResponse.json({
        message: 'Cards already exist in this quiz island',
        cardCount: existingCards?.length || 0,
      })
    }

    // Insert new cards
    const { data: cards, error: cardsError } = await supabase
      .from('quiz_cards')
      .insert(cardsToCreate)
      .select()

    if (cardsError) {
      console.error('Error creating cards:', cardsError)
      // Handle unique constraint violation (shouldn't happen due to check above, but just in case)
      if (cardsError.code === '23505') {
        return NextResponse.json(
          { error: 'One or more cards already exist' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to create cards' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: `Added ${cards?.length || 0} card(s)`,
      cardCount: cards?.length || 0,
      cardIds: cards?.map((c) => c.id) || [],
    })
  } catch (error) {
    console.error('Error in POST /api/quiz-islands/add-from-topic-item:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

