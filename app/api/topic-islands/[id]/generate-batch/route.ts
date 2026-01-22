import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateIslandBatch } from '@/lib/deepseek/generate'

/**
 * POST /api/topic-islands/[id]/generate-batch
 * Generate a batch of words for a topic island
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const islandId = params.id
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null
  let userId: string | null = null

  try {
    supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    userId = user.id

    // Get island and verify ownership
    const { data: island, error: islandError} = await supabase  
      .from('topic_islands')
      .select('*')
      .eq('id', islandId)
      .eq('user_id', user.id)
      .single()

    if (islandError || !island) {
      return NextResponse.json(
        { error: 'Island not found or access denied' },
        { status: 404 }
      )
    }

    const apiKey = process.env.DEEPSEEK_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json(
        { error: 'DEEPSEEK_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Prevent concurrent generation jobs for the same island
    if (island.status === 'generating') {
      return NextResponse.json({
        message: 'Generation already in progress',
        status: 'generating' as const,
      })
    }

    // Update status to generating
    await supabase
      .from('topic_islands')
      .update({ status: 'generating' })
      .eq('id', islandId)

    // Fetch 3-5 known words from other islands for context
    const { data: knownWordsData } = await supabase
      .from('island_words')
      .select('hanzi')
      .eq('user_id', user.id)
      .neq('island_id', islandId)
      .order('created_at', { ascending: false })
      .limit(50)

    const candidateKnownWords = knownWordsData?.map((w) => w.hanzi) || []
    const knownWords = candidateKnownWords
      .sort(() => 0.5 - Math.random())
      .slice(0, Math.min(5, candidateKnownWords.length))

    // Map stored level to base band for validation
    const mapToBaseLevel = (level: string | null): 'A2' | 'B1' | 'B2' => {
      if (!level) return 'B1'
      if (level.startsWith('A2')) return 'A2'
      if (level.startsWith('B1')) return 'B1'
      return 'B2'
    }

    const baseLevel = mapToBaseLevel(island.level as string)
    const detailedLevel = island.level as string
    const grammarTarget = island.grammar_target || 0

    let totalAdded = 0
    const maxIterations = 10 // Safety limit to avoid infinite loops
    let iterations = 0

    // Server-side loop: keep generating until we hit the target or a safety limit
    while (iterations < maxIterations) {
      iterations++

      // Check current count
      const { count: currentCount } = await supabase
        .from('island_words')
        .select('*', { count: 'exact', head: true })
        .eq('island_id', islandId)

      const currentWords = currentCount || 0

      // If we've reached the target, mark as ready and return
      if (currentWords >= island.word_target) {
        await supabase
          .from('topic_islands')
          .update({ status: 'ready' })
          .eq('id', islandId)

        return NextResponse.json({
          addedWords: totalAdded,
          totalWords: currentWords,
          status: 'ready' as const,
        })
      }

      // Get existing words to avoid duplicates
      const { data: existingWordsData } = await supabase
        .from('island_words')
        .select('hanzi')
        .eq('island_id', islandId)

      const existingWords = existingWordsData?.map((w) => w.hanzi) || []

      // Calculate batch size for this iteration
      const remaining = island.word_target - currentWords
      const batchSizeForThisCall = Math.min(5, remaining)

      if (batchSizeForThisCall <= 0) {
        break
      }

      // Generate words using DeepSeek
      let generatedData
      try {
        generatedData = await generateIslandBatch({
          topic: island.topic,
          level: baseLevel,
          detailedLevel,
          batchSize: batchSizeForThisCall,
          existingWords,
          grammarTarget,
          knownWords,
        })
      } catch (error) {
        console.error('DeepSeek generation error:', error)
        // Mark island as error
        await supabase
          .from('topic_islands')
          .update({ status: 'error' })
          .eq('id', islandId)

        return NextResponse.json(
          {
            error: 'Failed to generate words',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        )
      }

      // Insert words and sentences for this batch
      let batchAdded = 0
      for (const item of generatedData.items) {
        // Stop if we've reached the target
        const { count: checkCount } = await supabase
          .from('island_words')
          .select('*', { count: 'exact', head: true })
          .eq('island_id', islandId)

        if ((checkCount || 0) >= island.word_target) {
          break
        }

      // Insert word
      const { data: word, error: wordError } = await supabase
        .from('island_words')
        .insert({
          island_id: islandId,
          user_id: user.id,
          hanzi: item.word.hanzi,
          pinyin: item.word.pinyin,
          english: item.word.english,
          difficulty_tag: 'core',
        })
        .select()
        .single()

      if (wordError) {
        // If the island was deleted while generating (foreign key error),
        // stop gracefully instead of spamming errors.
        if ((wordError as any).code === '23503') {
          console.error(
            'Island not found while inserting word (foreign key error). Stopping generation.'
          )
          break
        }

        console.error('Error inserting word:', wordError)
        // Skip if duplicate or other non-fatal error
        continue
      }

        // Insert sentences with grammar tags
        const sentencesToInsert = item.sentences.map((sentence) => ({
          island_id: islandId,
          word_id: word.id,
          user_id: user.id,
          tier: sentence.tier,
          hanzi: sentence.hanzi,
          pinyin: sentence.pinyin,
          english: sentence.english,
          grammar_tag: sentence.grammarTag || null,
        }))

        await supabase.from('island_sentences').insert(sentencesToInsert)

        batchAdded++
      }

      totalAdded += batchAdded

      // If we didn't add anything in this iteration, break to avoid spinning
      if (batchAdded === 0) {
        break
      }
    }

    // Final status check
    const { count: finalCount } = await supabase
      .from('island_words')
      .select('*', { count: 'exact', head: true })
      .eq('island_id', islandId)

    const finalTotal = finalCount || 0

    if (finalTotal >= island.word_target) {
      await supabase
        .from('topic_islands')
        .update({ status: 'ready' })
        .eq('id', islandId)

      return NextResponse.json({
        addedWords: totalAdded,
        totalWords: finalTotal,
        status: 'ready' as const,
      })
    }

    // Not at target yet, mark as generating
    return NextResponse.json({
      addedWords: totalAdded,
      totalWords: finalTotal,
      status: 'generating' as const,
    })
  } catch (error) {
    console.error('Error in POST /api/topic-islands/[id]/generate-batch:', error)
    
    // Ensure island status is updated to error if we have the islandId and user
    if (islandId && userId && supabase) {
      try {
        // Verify ownership before updating status
        const { data: island } = await supabase
          .from('topic_islands')
          .select('id')
          .eq('id', islandId)
          .eq('user_id', userId)
          .single()

        if (island) {
          await supabase
            .from('topic_islands')
            .update({ status: 'error' })
            .eq('id', islandId)
        }
      } catch (statusError) {
        console.error('Error updating island status to error:', statusError)
      }
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

