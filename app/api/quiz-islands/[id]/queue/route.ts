import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/quiz-islands/[id]/queue
 * Get cards for review (due cards + new cards)
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

    // Call the RPC (70% new queue cards, 30% review cards for 10-card sessions)
    const { data, error } = await supabase.rpc('get_quiz_queue', {
      p_quiz_island_id: params.id,
      p_new_limit: 7,      // 70% of 10-card session
      p_review_limit: 3,   // 30% of 10-card session
    })

    if (error) {
      console.error('Error fetching queue:', error)
      return NextResponse.json(
        { error: 'Failed to fetch queue' },
        { status: 500 }
      )
    }

    return NextResponse.json({ cards: data || [] })
  } catch (error) {
    console.error('Error in GET /api/quiz-islands/[id]/queue:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

