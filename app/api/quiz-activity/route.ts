import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { incrementHuahua } from '@/lib/huahua'

export const dynamic = 'force-dynamic'

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

    const countsByDate = new Map<string, number>()

    // 1. Quiz island sessions (grade API) and any card reviews
    const { data: events, error } = await supabase
      .from('quiz_activity_events')
      .select('reviewed_at')
      .eq('user_id', user.id)
      .gte('reviewed_at', start.toISOString())
      .lt('reviewed_at', end.toISOString())

    if (!error && events && events.length > 0) {
      for (const event of events) {
        const reviewedAtMs = new Date(event.reviewed_at).getTime()
        const localMs = reviewedAtMs - tzOffsetMinutes * 60 * 1000
        const dateKey = new Date(localMs).toISOString().split('T')[0]
        countsByDate.set(dateKey, (countsByDate.get(dateKey) || 0) + 1)
      }
    } else if (error) {
      console.error('Error fetching quiz activity:', error)
    }

    // 2. Topic-island in-page flashcard reviews (no card_id)
    const { data: topicEvents, error: topicError } = await supabase
      .from('topic_island_review_events')
      .select('reviewed_at')
      .eq('user_id', user.id)
      .gte('reviewed_at', start.toISOString())
      .lt('reviewed_at', end.toISOString())

    if (!topicError && topicEvents && topicEvents.length > 0) {
      for (const event of topicEvents) {
        const reviewedAtMs = new Date(event.reviewed_at).getTime()
        const localMs = reviewedAtMs - tzOffsetMinutes * 60 * 1000
        const dateKey = new Date(localMs).toISOString().split('T')[0]
        countsByDate.set(dateKey, (countsByDate.get(dateKey) || 0) + 1)
      }
    } else if (topicError) {
      console.error('Error fetching topic island review activity:', topicError)
    }

    // 3. Fallback: card_review_state if no events tables had data (legacy)
    if (countsByDate.size === 0) {
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

/**
 * POST /api/quiz-activity
 * Record topic-island in-page flashcard/drag-drop reviews (for Progress Island count).
 * Body: optional { count: number } — default 1. Inserts that many events for today.
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

    let count = 1
    let body: { count?: number; tzOffset?: number } = {}
    try {
      body = await request.json().catch(() => ({}))
      if (typeof body?.count === 'number' && body.count > 1 && body.count <= 50) {
        count = Math.floor(body.count)
      }
    } catch {
      // ignore
    }

    const now = new Date().toISOString()
    const rows = Array.from({ length: count }, () => ({
      user_id: user.id,
      reviewed_at: now,
    }))

    const { error } = await supabase
      .from('topic_island_review_events')
      .insert(rows)

    if (error) {
      // Log but don't abort — 华华 progress must advance regardless of event-log failures.
      console.error('Error recording topic island review:', error)
    }

    // Advance 华华 progression (daily-resetting counter).
    const { huahuaReviewsToday, huahuaStage } = await incrementHuahua(supabase, user.id, count)

    return NextResponse.json({
      ok: true,
      todayCount: huahuaReviewsToday,
      huahuaTotalReviews: huahuaReviewsToday,
      huahuaStage,
    })
  } catch (error) {
    console.error('Error in POST /api/quiz-activity:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
