import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * DELETE /api/quiz-islands/[id]/cards/[cardId]
 * Delete a card from a quiz island
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

    // Verify card belongs to user and is in this quiz island
    const { data: collection } = await supabase
      .from('card_collections')
      .select('card_id')
      .eq('card_id', params.cardId)
      .eq('collection_type', 'quiz_island')
      .eq('collection_id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!collection) {
      return NextResponse.json(
        { error: 'Card not found in this quiz island' },
        { status: 404 }
      )
    }

    // Delete the card_collection entry (card itself remains for other collections)
    const { error } = await supabase
      .from('card_collections')
      .delete()
      .eq('card_id', params.cardId)
      .eq('collection_type', 'quiz_island')
      .eq('collection_id', params.id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting card:', error)
      return NextResponse.json(
        { error: 'Failed to delete card' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Card deleted successfully' })
  } catch (error) {
    console.error('Error in DELETE /api/quiz-islands/[id]/cards/[cardId]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

