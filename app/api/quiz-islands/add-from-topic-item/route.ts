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

    // Check for existing cards from this source
    const { data: existingCards } = await supabase
      .from('cards')
      .select('id, front_lang, back_lang')
      .eq('user_id', user.id)
      .eq('source_type', type === 'word' ? 'topic_word' : 'topic_sentence')
      .eq('source_ref_id', sourceId)

    // Determine which cards to create
    const cardsToCreate = []
    const shouldCreateReverse = type === 'word' && (createReverse !== false) // Default true for words

    // Always create ZH_EN for both words and sentences
    const hasZH_EN = existingCards?.some(
      (c) => c.front_lang === 'zh' && c.back_lang === 'en'
    )
    if (!hasZH_EN) {
      cardsToCreate.push({
        user_id: user.id,
        front: hanzi,
        back: english,
        front_lang: 'zh',
        back_lang: 'en',
        pinyin: pinyin,
        source_type: type === 'word' ? 'topic_word' : 'topic_sentence',
        source_ref_id: sourceId,
      })
    }

    // Create EN_ZH only for words (if requested)
    if (shouldCreateReverse) {
      const hasEN_ZH = existingCards?.some(
        (c) => c.front_lang === 'en' && c.back_lang === 'zh'
      )
      if (!hasEN_ZH) {
        cardsToCreate.push({
          user_id: user.id,
          front: english,
          back: hanzi,
          front_lang: 'en',
          back_lang: 'zh',
          pinyin: null,
          source_type: type === 'word' ? 'topic_word' : 'topic_sentence',
          source_ref_id: sourceId,
        })
      }
    }

    if (cardsToCreate.length === 0) {
      // Cards already exist - check if they're in this quiz island
      const existingCardIds = existingCards?.map((c) => c.id) || []
      const { data: existingCollections } = await supabase
        .from('card_collections')
        .select('card_id')
        .eq('user_id', user.id)
        .eq('collection_type', 'quiz_island')
        .eq('collection_id', quizIslandId)
        .in('card_id', existingCardIds)

      if (existingCollections && existingCollections.length > 0) {
        return NextResponse.json({
          message: 'Cards already exist in this quiz island',
          cardCount: existingCollections.length,
        })
      }

      // Cards exist but not in this quiz island - add them
      const collectionsToInsert = existingCardIds.map((cardId) => ({
        user_id: user.id,
        collection_type: 'quiz_island',
        collection_id: quizIslandId,
        card_id: cardId,
      }))

      const { error: collectionsError } = await supabase
        .from('card_collections')
        .insert(collectionsToInsert)

      if (collectionsError) {
        console.error('Error adding cards to collection:', collectionsError)
        return NextResponse.json(
          { error: 'Failed to add cards to quiz island' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        message: `Added ${existingCardIds.length} card(s)`,
        cardCount: existingCardIds.length,
        cardIds: existingCardIds,
      })
    }

    // Insert new cards
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .insert(cardsToCreate)
      .select()

    if (cardsError) {
      console.error('Error creating cards:', cardsError)
      return NextResponse.json(
        { error: 'Failed to create cards' },
        { status: 500 }
      )
    }

    // Create card_collections entries
    const collectionsToInsert = (cards || []).map((card) => ({
      user_id: user.id,
      collection_type: 'quiz_island',
      collection_id: quizIslandId,
      card_id: card.id,
    }))

    const { error: collectionsError } = await supabase
      .from('card_collections')
      .insert(collectionsToInsert)

    if (collectionsError) {
      console.error('Error creating card collections:', collectionsError)
      // Cards were created but collections failed - not ideal but continue
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

