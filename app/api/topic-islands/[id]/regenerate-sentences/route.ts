import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateWordSentences } from '@/lib/deepseek/generate-word-sentences'

interface Word {
  id: string
  hanzi: string
  pinyin: string
  english: string
}

/**
 * POST /api/topic-islands/[id]/regenerate-sentences
 * 
 * Checks for words missing example sentences and regenerates them.
 * This is a safety net for when sentence generation fails during island creation.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const islandId = params.id

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get island details
    const { data: island, error: islandError } = await supabase
      .from('topic_islands')
      .select('*')
      .eq('id', islandId)
      .eq('user_id', user.id)
      .single()

    if (islandError || !island) {
      return NextResponse.json({ error: 'Island not found' }, { status: 404 })
    }

    // Find all words for this island
    const { data: allWords, error: wordsError } = await supabase
      .from('island_words')
      .select('id, hanzi, pinyin, english')
      .eq('island_id', islandId)
      .order('created_at', { ascending: true })

    if (wordsError || !allWords) {
      return NextResponse.json(
        { error: 'Failed to fetch words' },
        { status: 500 }
      )
    }

    // For each word, check if it has all 3 sentences (easy, same, hard)
    const wordsNeedingSentences: Word[] = []

    for (const word of allWords) {
      const { count } = await supabase
        .from('island_sentences')
        .select('*', { count: 'exact', head: true })
        .eq('word_id', word.id)

      // Each word should have exactly 3 sentences
      if ((count || 0) < 3) {
        wordsNeedingSentences.push(word)
      }
    }

    if (wordsNeedingSentences.length === 0) {
      return NextResponse.json({
        message: 'All words have complete sentences',
        regenerated: 0,
        total: allWords.length,
      })
    }

    console.log(
      `Found ${wordsNeedingSentences.length} words missing sentences for island ${islandId}`
    )

    // Get base level from island
    const baseLevel = (island.level as 'A1' | 'A2' | 'B1' | 'B2' | 'C1') || 'B1'
    const grammarTarget = island.grammar_target || 0

    let regeneratedCount = 0
    const errors: string[] = []

    // Regenerate sentences for each word missing them
    for (const word of wordsNeedingSentences) {
      try {
        console.log(`Regenerating sentences for word: ${word.hanzi}`)

        // First, delete any existing sentences for this word (may be incomplete)
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
          wordIndex: 0, // Not used for retry
          totalWords: 1,
        })

        if (sentences.length !== 3) {
          throw new Error(
            `Expected 3 sentences, got ${sentences.length} for word ${word.hanzi}`
          )
        }

        // Insert new sentences
        const sentencesToInsert = sentences.map((sentence) => ({
          island_id: islandId,
          word_id: word.id,
          user_id: user.id,
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
        console.log(`Successfully regenerated sentences for ${word.hanzi}`)
      } catch (error) {
        const errorMsg = `Failed to regenerate sentences for ${word.hanzi}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }

    return NextResponse.json({
      message: `Regenerated sentences for ${regeneratedCount} out of ${wordsNeedingSentences.length} words`,
      regenerated: regeneratedCount,
      total: allWords.length,
      wordsMissing: wordsNeedingSentences.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error in regenerate-sentences:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
