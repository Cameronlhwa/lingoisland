import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
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

    const { data: journey, error: jErr } = await supabase
      .from('journeys')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (jErr || !journey) {
      return NextResponse.json({ error: 'Journey not found' }, { status: 404 })
    }

    const { data: islands, error: iErr } = await supabase
      .from('journey_islands')
      .select('*')
      .eq('journey_id', params.id)
      .order('step_order', { ascending: true })

    if (iErr) {
      return NextResponse.json({ error: 'Failed to load islands' }, { status: 500 })
    }

    const islandsOut = (islands ?? []).map((row) => {
      const { step_order, ...rest } = row as typeof row & { step_order: number }
      return { ...rest, order: step_order }
    })

    return NextResponse.json({ journey, islands: islandsOut })
  } catch (e) {
    console.error('[journey/id GET]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
