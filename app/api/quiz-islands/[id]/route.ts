import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/quiz-islands/[id]
 * Get a single quiz island with card count
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

    const { data: quizIsland, error } = await supabase
      .from('quiz_islands')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (error || !quizIsland) {
      return NextResponse.json(
        { error: 'Quiz island not found' },
        { status: 404 }
      )
    }

    // Get card count
    const { count, error: countError } = await supabase
      .from('quiz_cards')
      .select('*', { count: 'exact', head: true })
      .eq('quiz_island_id', params.id)
      .eq('user_id', user.id)

    if (countError) {
      console.error('Error counting cards:', countError)
    }

    return NextResponse.json({
      quizIsland: {
        ...quizIsland,
        card_count: count || 0,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/quiz-islands/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

