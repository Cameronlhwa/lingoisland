import { createClient } from '@supabase/supabase-js'
import { pickRandomCoverKey } from '../lib/islandLibrary'
import { config } from 'dotenv'
import path from 'node:path'

// Load environment variables from .env.local (Next.js convention)
config({ path: path.join(process.cwd(), '.env.local') })

async function main() {
  console.log('🔄 Backfilling island cover_key for existing islands...')
  console.log()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing environment variables:')
    console.error('  NEXT_PUBLIC_SUPABASE_URL')
    console.error('  SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  // Find ALL islands (will assign/replace cover_key for all)
  const { data: islands, error: fetchError } = await supabase
    .from('topic_islands')
    .select('id, topic, cover_key')

  if (fetchError) {
    console.error('❌ Error fetching islands:', fetchError)
    process.exit(1)
  }

  if (!islands || islands.length === 0) {
    console.log('✅ No islands found in database!')
    return
  }

  console.log(`Found ${islands.length} islands to assign cover images`)
  console.log()

  let successCount = 0
  let failCount = 0

  for (const island of islands) {
    const coverKey = pickRandomCoverKey()
    const hadCoverBefore = island.cover_key ? '(replaced)' : '(new)'
    
    const { error: updateError } = await supabase
      .from('topic_islands')
      .update({ cover_key: coverKey })
      .eq('id', island.id)

    if (updateError) {
      console.error(`❌ Failed to update island ${island.id} (${island.topic}):`, updateError.message)
      failCount++
    } else {
      console.log(`✅ ${island.topic} → ${coverKey} ${hadCoverBefore}`)
      successCount++
    }
  }

  console.log()
  console.log('=' .repeat(60))
  console.log(`Complete: ${successCount} updated, ${failCount} failed`)
  console.log('=' .repeat(60))
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
