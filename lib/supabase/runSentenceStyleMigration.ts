import postgres from 'postgres'
import { readFileSync } from 'fs'
import { join } from 'path'
import { resetSentenceStyleColumnCache } from '@/lib/supabase/schemaFeatures'

const MIGRATION_FILE = join(
  process.cwd(),
  'supabase/migrations/20260626_000001_sentence_style.sql',
)

export function getSentenceStyleDatabaseUrl(): string | null {
  const direct = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  if (direct) return direct

  const password = process.env.SUPABASE_DB_PASSWORD
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!password || !supabaseUrl) return null

  const ref = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
  if (!ref) return null

  return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`
}

export async function runSentenceStyleMigration(): Promise<{
  ok: true
  message: string
}> {
  const databaseUrl = getSentenceStyleDatabaseUrl()
  if (!databaseUrl) {
    throw new Error(
      'Set DATABASE_URL or SUPABASE_DB_PASSWORD (plus NEXT_PUBLIC_SUPABASE_URL) to run migrations.',
    )
  }

  const sqlText = readFileSync(MIGRATION_FILE, 'utf8')
  const sql = postgres(databaseUrl, { max: 1 })

  try {
    await sql.unsafe(sqlText)
    resetSentenceStyleColumnCache()
    return {
      ok: true,
      message: 'sentence_style columns added to topic_islands and journeys',
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
}
