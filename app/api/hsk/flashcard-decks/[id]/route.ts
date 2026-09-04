import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { denyWithoutProductAccess } from '@/lib/product-access'

/**
 * GET /api/hsk/flashcard-decks/[id]
 * Get a single HSK flashcard deck with card count.
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
    const denial = await denyWithoutProductAccess(user.id, 'hsk')
    if (denial) return denial

    const { data: deck, error } = await supabase
      .from('quiz_islands')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .eq('origin', 'hsk')
      .single()

    if (error || !deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 })
    }

    const { count, error: countError } = await supabase
      .from('card_collections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('collection_type', 'quiz_island')
      .eq('collection_id', params.id)

    if (countError) {
      console.error('Error counting cards:', countError)
    }

    return NextResponse.json({
      deck: {
        ...deck,
        card_count: count || 0,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/hsk/flashcard-decks/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/hsk/flashcard-decks/[id]
 * Rename an HSK flashcard deck.
 */
export async function PATCH(
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

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Name is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const { data: deck, error: updateError } = await supabase
      .from('quiz_islands')
      .update({ name: name.trim() })
      .eq('id', params.id)
      .eq('user_id', user.id)
      .eq('origin', 'hsk')
      .select()
      .single()

    if (updateError || !deck) {
      return NextResponse.json({ error: 'Deck not found or access denied' }, { status: 404 })
    }

    return NextResponse.json({ deck })
  } catch (error) {
    console.error('Error in PATCH /api/hsk/flashcard-decks/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
