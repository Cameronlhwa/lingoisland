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

    let query = supabase
      .from('quiz_cards')
      .select('*')
      .eq('quiz_island_id', params.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (direction && (direction === 'ZH_EN' || direction === 'EN_ZH')) {
      query = query.eq('direction', direction)
    }

    const { data: cards, error } = await query

    if (error) {
      console.error('Error fetching cards:', error)
      return NextResponse.json(
        { error: 'Failed to fetch cards' },
        { status: 500 }
      )
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

    const cardsToInsert = [
      {
        user_id: user.id,
        quiz_island_id: params.id,
        direction,
        front: front.trim(),
        back: back.trim(),
        pinyin: pinyin || null,
      },
    ]

    // Create reverse card if requested
    if (createReverse) {
      const reverseDirection = direction === 'ZH_EN' ? 'EN_ZH' : 'ZH_EN'
      cardsToInsert.push({
        user_id: user.id,
        quiz_island_id: params.id,
        direction: reverseDirection,
        front: back.trim(),
        back: front.trim(),
        pinyin: null, // Reverse cards don't need pinyin
      })
    }

    const { data: cards, error } = await supabase
      .from('quiz_cards')
      .insert(cardsToInsert)
      .select()

    if (error) {
      console.error('Error creating cards:', error)
      // Handle unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Card already exists' },
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

