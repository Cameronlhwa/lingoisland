import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type QueueCard = {
  id: string
  front: string
  back: string
  pinyin: string | null
  front_lang: string | null
  back_lang: string | null
  [key: string]: unknown
}

function contentKey(card: QueueCard): string {
  const isZhFirst =
    typeof card.front_lang === 'string' && card.front_lang.toLowerCase().startsWith('zh')
  return isZhFirst
    ? `${card.front}\u0000${card.back}`
    : `${card.back}\u0000${card.front}`
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Group cards by same word (ZH_EN and EN_ZH pair), shuffle group order and
 * within each group, then interleave so no two cards from the same word are adjacent.
 */
function interleaveByWord(queue: QueueCard[]): QueueCard[] {
  if (queue.length === 0) return []
  const byKey = new Map<string, QueueCard[]>()
  for (const card of queue) {
    const key = contentKey(card)
    const list = byKey.get(key) ?? []
    list.push(card)
    byKey.set(key, list)
  }
  const groups = shuffle(Array.from(byKey.values(), (g) => shuffle(g)))
  const result: QueueCard[] = []
  let index = 0
  while (result.length < queue.length) {
    let taken = 0
    for (const group of groups) {
      if (index < group.length) {
        const card = group[index]
        result.push(card as QueueCard)
        taken++
      }
    }
    if (taken === 0) break
    index++
  }
  return result
}

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

    // Quiz in groups of 10; request a larger window so interleaving has enough cards
    const SESSION_SIZE = 10
    const FETCH_PADDING = 12
    const { data, error } = await supabase.rpc('get_quiz_queue', {
      p_quiz_island_id: params.id,
      p_new_limit: FETCH_PADDING,
      p_review_limit: FETCH_PADDING,
    })

    if (error) {
      console.error('Error fetching queue:', error)
      return NextResponse.json(
        { error: 'Failed to fetch queue' },
        { status: 500 }
      )
    }

    const queue = (data || []) as QueueCard[]
    const interleaved = interleaveByWord(queue)
    // Always cap at 10 cards per session
    const cards = interleaved.slice(0, SESSION_SIZE)
    return NextResponse.json({ cards })
  } catch (error) {
    console.error('Error in GET /api/quiz-islands/[id]/queue:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

