import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/quiz-activity?year=YYYY&month=MM
 * Returns daily quiz activity counts for the given month.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const yearParam = searchParams.get('year')
    const monthParam = searchParams.get('month')
    const tzOffsetParam = searchParams.get('tzOffset')

    const now = new Date()
    const year = yearParam ? Number(yearParam) : now.getFullYear()
    const month = monthParam ? Number(monthParam) : now.getMonth() + 1

    const tzOffsetMinutes = tzOffsetParam ? Number(tzOffsetParam) : 0
    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12 ||
      !Number.isFinite(tzOffsetMinutes)
    ) {
      return NextResponse.json(
        { error: 'Invalid year or month' },
        { status: 400 }
      )
    }

    const startUtcMs = Date.UTC(year, month - 1, 1) + tzOffsetMinutes * 60 * 1000
    const endUtcMs = Date.UTC(year, month, 1) + tzOffsetMinutes * 60 * 1000
    const start = new Date(startUtcMs)
    const end = new Date(endUtcMs)

    const { data: events, error } = await supabase
      .from('quiz_activity_events')
      .select('reviewed_at')
      .eq('user_id', user.id)
      .gte('reviewed_at', start.toISOString())
      .lt('reviewed_at', end.toISOString())

    const countsByDate = new Map<string, number>()
    if (!error && events && events.length > 0) {
      for (const event of events) {
        const reviewedAtMs = new Date(event.reviewed_at).getTime()
        const localMs = reviewedAtMs - tzOffsetMinutes * 60 * 1000
        const dateKey = new Date(localMs).toISOString().split('T')[0]
        countsByDate.set(dateKey, (countsByDate.get(dateKey) || 0) + 1)
      }
    } else {
      if (error) {
        console.error('Error fetching quiz activity:', error)
      }

      const { data: reviewStates, error: fallbackError } = await supabase
        .from('card_review_state')
        .select('last_reviewed_at')
        .eq('user_id', user.id)
        .gte('last_reviewed_at', start.toISOString())
        .lt('last_reviewed_at', end.toISOString())

      if (fallbackError) {
        console.error('Error fetching review activity:', fallbackError)
        return NextResponse.json(
          { error: 'Failed to fetch activity' },
          { status: 500 }
        )
      }

      for (const state of reviewStates || []) {
        if (!state.last_reviewed_at) continue
        const reviewedAtMs = new Date(state.last_reviewed_at).getTime()
        const localMs = reviewedAtMs - tzOffsetMinutes * 60 * 1000
        const dateKey = new Date(localMs).toISOString().split('T')[0]
        countsByDate.set(dateKey, (countsByDate.get(dateKey) || 0) + 1)
      }
    }

    const activity = Array.from(countsByDate.entries()).map(([date, count]) => ({
      date,
      count,
    }))

    return NextResponse.json(
      { activity },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('Error in GET /api/quiz-activity:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

