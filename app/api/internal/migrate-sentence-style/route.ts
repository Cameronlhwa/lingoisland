import { NextResponse } from 'next/server'
import { runSentenceStyleMigration } from '@/lib/supabase/runSentenceStyleMigration'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * One-time schema migration for sentence_style columns.
 * POST with Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>
 *
 * Requires DATABASE_URL or SUPABASE_DB_PASSWORD in server env.
 */
export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not configured' },
      { status: 500 },
    )
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runSentenceStyleMigration()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[migrate-sentence-style]', error)
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 })
  }
}
