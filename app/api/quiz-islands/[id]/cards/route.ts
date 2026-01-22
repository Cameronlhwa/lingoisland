import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/quiz-islands/[id]/cards
 * Get all cards for a quiz island
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
      .single()

    if (!quizIsland) {
      return NextResponse.json(
        { error: 'Quiz island not found or access denied' },
        { status: 404 }
      )
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url)
    const direction = searchParams.get('direction') // 'ZH_EN', 'EN_ZH', or null for all

    // Get cards via card_collections
    let query = supabase
      .from('card_collections')
      .select(`
        card_id,
        cards (*)
      `)
      .eq('collection_type', 'quiz_island')
      .eq('collection_id', params.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    const { data: collections, error } = await query

    if (error) {
      console.error('Error fetching cards:', error)
      return NextResponse.json(
        { error: 'Failed to fetch cards' },
        { status: 500 }
      )
    }

    // Extract cards from collections
    let cards = (collections || [])
      .map((c: any) => c.cards)
      .filter((card: any) => card !== null)

    // Filter by direction if specified
    if (direction && (direction === 'ZH_EN' || direction === 'EN_ZH')) {
      cards = cards.filter((card: any) => {
        if (direction === 'ZH_EN') {
          return card.front_lang === 'zh' && card.back_lang === 'en'
        } else {
          return card.front_lang === 'en' && card.back_lang === 'zh'
        }
      })
    }

    return NextResponse.json({ cards: cards || [] })
  } catch (error) {
    console.error('Error in GET /api/quiz-islands/[id]/cards:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/quiz-islands/[id]/cards
 * Add a card to a quiz island
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

    const body = await request.json()
    const { front, back, pinyin, direction, createReverse } = body

    if (!front || !back || !direction) {
      return NextResponse.json(
        { error: 'Front, back, and direction are required' },
        { status: 400 }
      )
    }

    if (!['ZH_EN', 'EN_ZH'].includes(direction)) {
      return NextResponse.json(
        { error: 'Direction must be ZH_EN or EN_ZH' },
        { status: 400 }
      )
    }

    // Determine languages based on direction
    const frontLang = direction === 'ZH_EN' ? 'zh' : 'en'
    const backLang = direction === 'ZH_EN' ? 'en' : 'zh'

    const cardsToInsert = [
      {
        user_id: user.id,
        front: front.trim(),
        back: back.trim(),
        front_lang: frontLang,
        back_lang: backLang,
        pinyin: pinyin || null,
        source_type: 'quiz_island',
        source_ref_id: params.id,
      },
    ]

    // Create reverse card if requested
    if (createReverse) {
      cardsToInsert.push({
        user_id: user.id,
        front: back.trim(),
        back: front.trim(),
        front_lang: backLang,
        back_lang: frontLang,
        pinyin: null, // Reverse cards don't need pinyin
        source_type: 'quiz_island',
        source_ref_id: params.id,
      })
    }

    // Insert cards
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .insert(cardsToInsert)
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
      collection_id: params.id,
      card_id: card.id,
    }))

    const { error: collectionsError } = await supabase
      .from('card_collections')
      .insert(collectionsToInsert)

    if (collectionsError) {
      console.error('Error creating card collections:', collectionsError)
      // Cards were created, but collections failed - not ideal but continue
    }

    return NextResponse.json({
      message: `Added ${cards?.length || 0} card(s)`,
      cards: cards || [],
    })
  } catch (error) {
    console.error('Error in POST /api/quiz-islands/[id]/cards:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

