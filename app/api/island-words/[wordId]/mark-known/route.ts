import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateReplacementWord } from '@/lib/deepseek/generate-replacement'

/**
 * POST /api/island-words/[wordId]/mark-known
 * Mark a word as known and replace it with a new one
 */
export async function POST(
  request: Request,
  { params }: { params: { wordId: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const wordId = params.wordId

    // Get word and verify ownership
    const { data: word, error: wordError } = await supabase
      .from('island_words')
      .select('*, topic_islands(*)')
      .eq('id', wordId)
      .eq('user_id', user.id)
      .single()

    if (wordError || !word) {
      return NextResponse.json(
        { error: 'Word not found or access denied' },
        { status: 404 }
      )
    }

    const island = word.topic_islands as any

    // Get existing words BEFORE deleting (to check for duplicates)
    const { data: existingWordsData } = await supabase
      .from('island_words')
      .select('hanzi')
      .eq('island_id', island.id)
      .neq('id', wordId) // Exclude the word we're about to delete

    const existingWords = existingWordsData?.map((w) => w.hanzi) || []

    // Generate replacement word first (word only, then sentences)
    let newWordData = null
    try {
      newWordData = await generateReplacementWord({
        topic: island.topic,
        level: island.level as 'A2' | 'B1' | 'B2',
        existingWords,
        maxRetries: 5, // More retries to ensure uniqueness
      })
    } catch (error) {
      console.error('Error generating replacement word:', error)
      // Delete the old word even if generation fails
      await supabase.from('island_sentences').delete().eq('word_id', wordId)
      await supabase.from('island_words').delete().eq('id', wordId)

      return NextResponse.json(
        {
          error: 'Failed to generate replacement word',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      )
    }

    if (!newWordData) {
      // Delete old word even if no replacement
      await supabase.from('island_sentences').delete().eq('word_id', wordId)
      await supabase.from('island_words').delete().eq('id', wordId)

      return NextResponse.json(
        { error: 'Failed to generate replacement word' },
        { status: 500 }
      )
    }

    // Final check: make sure the new word doesn't exist (race condition protection)
    const { data: duplicateCheck } = await supabase
      .from('island_words')
      .select('hanzi')
      .eq('island_id', island.id)
      .eq('hanzi', newWordData.word.hanzi)
      .single()

    if (duplicateCheck) {
      // Word already exists, delete old word and return error
      await supabase.from('island_sentences').delete().eq('word_id', wordId)
      await supabase.from('island_words').delete().eq('id', wordId)

      return NextResponse.json(
        { error: 'Generated word already exists. Please try again.' },
        { status: 409 }
      )
    }

    // Delete old word and its sentences
    await supabase.from('island_sentences').delete().eq('word_id', wordId)
    await supabase.from('island_words').delete().eq('id', wordId)

    // Insert new word
    const { data: insertedWord, error: insertError } = await supabase
      .from('island_words')
      .insert({
        island_id: island.id,
        user_id: user.id,
        hanzi: newWordData.word.hanzi,
        pinyin: newWordData.word.pinyin,
        english: newWordData.word.english,
        difficulty_tag: 'core',
      })
      .select()
      .single()

    if (insertError || !insertedWord) {
      console.error('Error inserting new word:', insertError)
      return NextResponse.json(
        { error: 'Failed to insert replacement word' },
        { status: 500 }
      )
    }

    // Insert sentences
    for (const sentence of newWordData.sentences) {
      await supabase.from('island_sentences').insert({
        island_id: island.id,
        word_id: insertedWord.id,
        user_id: user.id,
        tier: sentence.tier,
        hanzi: sentence.hanzi,
        pinyin: sentence.pinyin,
        english: sentence.english,
      })
    }

    // Get the new word with sentences for response
    const { data: newWordSentences } = await supabase
      .from('island_sentences')
      .select('*')
      .eq('word_id', insertedWord.id)
      .order('tier', { ascending: true })

    const newWord = {
      ...insertedWord,
      sentences: newWordSentences || [],
    }

    // Return only the new word (frontend will replace just that card)
    return NextResponse.json({
      newWord,
      deletedWordId: wordId,
    })
  } catch (error) {
    console.error('Error in POST /api/island-words/[wordId]/mark-known:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

