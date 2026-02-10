#!/usr/bin/env tsx
/**
 * Backfill Missing Sentences for Free Users
 * 
 * This script identifies all topic islands where words are missing sentences
 * (typically from when the position-based paywall was active) and regenerates
 * the missing sentences.
 * 
 * Usage:
 *   tsx scripts/backfillMissingSentences.ts [--dry-run] [--user-id=xxx]
 * 
 * Options:
 *   --dry-run     Show what would be done without making changes
 *   --user-id     Only process islands for a specific user
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

interface IslandWithMissingSentences {
  island_id: string
  island_name: string
  user_id: string
  total_words: number
  words_missing_sentences: number
}

async function findIslandsWithMissingSentences(
  userId?: string
): Promise<IslandWithMissingSentences[]> {
  console.log('Scanning for islands with missing sentences...\n')

  // Get all ready islands (optionally filtered by user)
  let islandsQuery = supabase
    .from('topic_islands')
    .select('id, topic, user_id')
    .eq('status', 'ready')
    .order('created_at', { ascending: true })

  if (userId) {
    islandsQuery = islandsQuery.eq('user_id', userId)
  }

  const { data: islands, error: islandsError } = await islandsQuery

  if (islandsError) {
    throw new Error(`Failed to fetch islands: ${islandsError.message}`)
  }

  if (!islands || islands.length === 0) {
    console.log('No islands found.')
    return []
  }

  console.log(`Found ${islands.length} islands. Checking each for missing sentences...\n`)

  const islandsWithMissing: IslandWithMissingSentences[] = []

  for (const island of islands) {
    // Get all words for this island
    const { data: words, error: wordsError } = await supabase
      .from('island_words')
      .select('id')
      .eq('island_id', island.id)

    if (wordsError) {
      console.error(
        `[${island.id}] Error fetching words: ${wordsError.message}`
      )
      continue
    }

    if (!words || words.length === 0) {
      continue
    }

    // Check how many words are missing sentences
    let wordsMissingSentences = 0

    for (const word of words) {
      const { count } = await supabase
        .from('island_sentences')
        .select('*', { count: 'exact', head: true })
        .eq('word_id', word.id)

      if ((count || 0) < 3) {
        wordsMissingSentences++
      }
    }

    if (wordsMissingSentences > 0) {
      islandsWithMissing.push({
        island_id: island.id,
        island_name: island.topic,
        user_id: island.user_id,
        total_words: words.length,
        words_missing_sentences: wordsMissingSentences,
      })

      console.log(
        `✗ ${island.topic} (${island.id.slice(0, 8)}...): ${wordsMissingSentences}/${words.length} words missing sentences`
      )
    }
  }

  return islandsWithMissing
}

async function regenerateSentencesForIsland(
  islandId: string,
  islandName: string,
  userId: string
): Promise<{ success: boolean; regenerated: number; error?: string }> {
  try {
    console.log(`\n🔄 Regenerating sentences for "${islandName}"...`)

    // Get island details to pass to sentence generation
    const { data: island } = await supabase
      .from('topic_islands')
      .select('*')
      .eq('id', islandId)
      .eq('user_id', userId)
      .single()

    if (!island) {
      throw new Error('Island not found')
    }

    // Find all words for this island that need sentences
    const { data: allWords } = await supabase
      .from('island_words')
      .select('id, hanzi, pinyin, english')
      .eq('island_id', islandId)
      .order('created_at', { ascending: true })

    if (!allWords || allWords.length === 0) {
      return { success: true, regenerated: 0 }
    }

    // Check which words need sentences
    const wordsNeedingSentences = []
    for (const word of allWords) {
      const { count } = await supabase
        .from('island_sentences')
        .select('*', { count: 'exact', head: true })
        .eq('word_id', word.id)

      if ((count || 0) < 3) {
        wordsNeedingSentences.push(word)
      }
    }

    if (wordsNeedingSentences.length === 0) {
      return { success: true, regenerated: 0 }
    }

    console.log(`  Found ${wordsNeedingSentences.length} words needing sentences`)

    // Import sentence generation
    const { generateWordSentences } = await import('../lib/deepseek/generate-word-sentences.js')
    
    const baseLevel = (island.level as 'A1' | 'A2' | 'B1' | 'B2' | 'C1') || 'B1'
    const grammarTarget = island.grammar_target || 0

    let regeneratedCount = 0

    for (const word of wordsNeedingSentences) {
      try {
        // Delete any existing sentences for this word
        await supabase
          .from('island_sentences')
          .delete()
          .eq('word_id', word.id)

        // Generate new sentences
        const sentences = await generateWordSentences({
          word: {
            hanzi: word.hanzi,
            pinyin: word.pinyin,
            english: word.english,
          },
          topic: island.topic,
          level: baseLevel,
          grammarTarget,
          wordIndex: 0,
          totalWords: 1,
        })

        if (sentences.length !== 3) {
          throw new Error(`Expected 3 sentences, got ${sentences.length}`)
        }

        // Insert new sentences
        const sentencesToInsert = sentences.map((sentence) => ({
          island_id: islandId,
          word_id: word.id,
          user_id: userId,
          tier: sentence.tier,
          hanzi: sentence.hanzi,
          pinyin: sentence.pinyin,
          english: sentence.english,
          grammar_tag: sentence.grammarTag || null,
        }))

        const { error: insertError } = await supabase
          .from('island_sentences')
          .insert(sentencesToInsert)

        if (insertError) {
          throw insertError
        }

        regeneratedCount++
        console.log(`    ✓ ${word.hanzi}`)
      } catch (error) {
        console.error(`    ✗ ${word.hanzi}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    console.log(
      `✓ Regenerated ${regeneratedCount}/${wordsNeedingSentences.length} words for "${islandName}"`
    )

    return {
      success: true,
      regenerated: regeneratedCount,
    }
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : 'Unknown error'
    console.error(`✗ Failed to regenerate "${islandName}": ${errorMsg}`)
    return {
      success: false,
      regenerated: 0,
      error: errorMsg,
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const userIdArg = args.find((arg) => arg.startsWith('--user-id='))
  const userId = userIdArg ? userIdArg.split('=')[1] : undefined

  console.log('='.repeat(60))
  console.log('Backfill Missing Sentences')
  console.log('='.repeat(60))
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`)
  if (userId) {
    console.log(`User filter: ${userId}`)
  }
  console.log('='.repeat(60))
  console.log()

  // Find islands with missing sentences
  const islands = await findIslandsWithMissingSentences(userId)

  if (islands.length === 0) {
    console.log('\n✓ All islands have complete sentences!')
    return
  }

  console.log(`\nFound ${islands.length} island(s) with missing sentences.`)

  if (isDryRun) {
    console.log('\n[DRY RUN] Would regenerate sentences for:')
    islands.forEach((island) => {
      console.log(
        `  - ${island.island_name}: ${island.words_missing_sentences} words`
      )
    })
    console.log('\nRun without --dry-run to execute.')
    return
  }

  // Confirm before proceeding
  console.log('\nThis will regenerate sentences for all affected islands.')
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n')
  await new Promise((resolve) => setTimeout(resolve, 5000))

  // Process each island
  let totalRegenerated = 0
  let successCount = 0
  let failureCount = 0

  for (const island of islands) {
    const result = await regenerateSentencesForIsland(
      island.island_id,
      island.island_name,
      island.user_id
    )

    if (result.success) {
      successCount++
      totalRegenerated += result.regenerated
    } else {
      failureCount++
    }

    // Small delay between islands
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  console.log('\n' + '='.repeat(60))
  console.log('Summary')
  console.log('='.repeat(60))
  console.log(`Islands processed: ${islands.length}`)
  console.log(`Successful: ${successCount}`)
  console.log(`Failed: ${failureCount}`)
  console.log(`Total words regenerated: ${totalRegenerated}`)
  console.log('='.repeat(60))
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
