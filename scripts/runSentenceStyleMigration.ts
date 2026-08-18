import dotenv from 'dotenv'
import { runSentenceStyleMigration } from '@/lib/supabase/runSentenceStyleMigration'

dotenv.config({ path: '.env.local' })

async function main() {
  const result = await runSentenceStyleMigration()
  console.log(result.message)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
