import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { denyWithoutProductAccess } from '@/lib/product-access'

/**
 * DELETE /api/hsk/flashcard-decks/[id]/cards/[cardId]
 * Delete a card from an HSK flashcard deck.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string; cardId: string } }
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

    const { data: deck } = await supabase
      .from('quiz_islands')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .eq('origin', 'hsk')
      .single()

    if (!deck) {
      return NextResponse.json({ error: 'Deck not found or access denied' }, { status: 404 })
    }

    const { data: collection } = await supabase
      .from('card_collections')
      .select('card_id')
      .eq('card_id', params.cardId)
      .eq('collection_type', 'quiz_island')
      .eq('collection_id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!collection) {
      return NextResponse.json({ error: 'Card not found in this deck' }, { status: 404 })
    }

    const { error } = await supabase
      .from('card_collections')
      .delete()
      .eq('card_id', params.cardId)
      .eq('collection_type', 'quiz_island')
      .eq('collection_id', params.id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting card:', error)
      return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Card deleted successfully' })
  } catch (error) {
    console.error('Error in DELETE /api/hsk/flashcard-decks/[id]/cards/[cardId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
