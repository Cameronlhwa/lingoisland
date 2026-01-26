import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateWordList } from '@/lib/deepseek/generate-word-list'
import {
  generateWordSentences,
  type Word,
} from '@/lib/deepseek/generate-word-sentences'
import { limitConcurrency } from '@/lib/utils/concurrency'

const clampCount = (value: number) => Math.min(10, Math.max(5, value))

const normalizeHanzi = (value: string) => value.trim()

const mapToBaseLevel = (level: string | null): 'A2' | 'B1' | 'B2' => {
  if (!level) return 'B1'
  if (level.startsWith('A2')) return 'A2'
  if (level.startsWith('B1')) return 'B1'
  return 'B2'
}

const pickRandomUnique = <T,>(source: T[], count: number): T[] => {
  const copy = [...source]
  const result: T[] = []
  const target = Math.min(count, copy.length)
  while (result.length < target) {
    const index = Math.floor(Math.random() * copy.length)
    result.push(copy.splice(index, 1)[0])
  }
  return result
}

const sanitizeSentenceText = (text: string) =>
  text.replace(/^[\s\-–—•]+/, '').replace(/^["'“”]+/, '').trim()

export async function POST(
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

    const islandId = params.id
    const body = await request.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const requestedCount = Number(body.count)
    const count = clampCount(
      Number.isFinite(requestedCount) ? Math.floor(requestedCount) : 7
    )
    const recycleOldWords = body.recycleOldWords !== false
    const rawSuggestions = Array.isArray(body.suggestions) ? body.suggestions : []
    const suggestions: string[] = Array.from(
      new Set(
        rawSuggestions
          .map((value: unknown) => String(value || '').trim())
          .filter((value: string) => value.length > 0)
      )
    )

    const { data: island, error: islandError } = await supabase
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

    const { data: existingWordsData } = await supabase
      .from('island_words')
      .select('hanzi')
      .eq('island_id', islandId)

    const existingWords =
      existingWordsData?.map((word) => normalizeHanzi(word.hanzi)) || []
    const existingWordsSet = new Set(existingWords)

    const filteredSuggestions = suggestions.filter(
      (word) => !existingWordsSet.has(normalizeHanzi(word))
    )

    const baseLevel = mapToBaseLevel(island.level as string)
    const detailedLevel = island.level as string
    const grammarTarget = island.grammar_target || 0

    let grammarTags: string[] = []
    if (grammarTarget > 0) {
      const grammarPatternsByLevel: Record<string, string[]> = {
        A2: [
          '了 (change of state)',
          '过 (experience)',
          '在/正在 (progressive)',
          '会/能/可以 (ability)',
          '要/得/应该 (need/should)',
        ],
        B1: [
          '比 (comparison)',
          '把 (only if natural)',
          '被 (passive)',
          '结果补语 (e.g., 好/完/到)',
          '起来/下去/出来 (directional)',
          '一边…一边…',
          '先…再…',
        ],
        B2: [
          '连…都…',
          '即使…也…',
          '既然…就…',
          '不但…而且…',
          '越…越…',
          '反正…',
          '干脆…',
        ],
      }

      const patterns = grammarPatternsByLevel[baseLevel] || grammarPatternsByLevel.B1
      grammarTags = patterns.slice(0, Math.min(grammarTarget, patterns.length))
    }

    const wordList = await generateWordList({
      topic: island.topic,
      level: baseLevel,
      detailedLevel,
      wordCount: count,
      existingWords,
      suggestions: filteredSuggestions,
    })

    const skippedWords: string[] = []
    const dedupedWords: Word[] = []
    const seenHanzi = new Set<string>()

    for (const word of wordList) {
      const normalized = normalizeHanzi(word.hanzi)
      if (!normalized) {
        continue
      }
      if (existingWordsSet.has(normalized)) {
        skippedWords.push(normalized)
        continue
      }
      if (seenHanzi.has(normalized)) {
        skippedWords.push(normalized)
        continue
      }
      seenHanzi.add(normalized)
      dedupedWords.push({
        ...word,
        hanzi: normalized,
      })
    }

    const insertedWords: Array<Word & { id: string }> = []
    for (const word of dedupedWords) {
      const { data: inserted, error } = await supabase
        .from('island_words')
        .insert({
          island_id: islandId,
          user_id: user.id,
          hanzi: word.hanzi,
          pinyin: word.pinyin,
          english: word.english,
          difficulty_tag: 'core',
        })
        .select()
        .single()

      if (error) {
        const errorCode = (error as { code?: string }).code
        if (errorCode === '23505') {
          skippedWords.push(word.hanzi)
          continue
        }
        if (errorCode === '23503') {
          break
        }
        console.error('Error inserting word:', error)
        continue
      }

      if (inserted) {
        insertedWords.push({ ...word, id: inserted.id })
      }
    }

    const knownWords =
      recycleOldWords && existingWords.length > 0
        ? pickRandomUnique(existingWords, 8)
        : undefined

    const sentenceTasks = insertedWords.map((word, index) => {
      return async () => {
      const retryConfigs = [
        undefined,
        {
          temperature: 0.8,
          topP: 0.9,
          frequencyPenalty: 0.4,
          presencePenalty: 0.2,
          maxTokens: 1800,
        },
        {
          temperature: 0.7,
          topP: 0.86,
          frequencyPenalty: 0.3,
          presencePenalty: 0.15,
          maxTokens: 1600,
        },
      ]

      let sentences = null
      for (let attempt = 0; attempt < retryConfigs.length; attempt += 1) {
        try {
          const retryHint =
            attempt === 0
              ? undefined
              : 'Each sentence must include the target word. Do not use bullets or list prefixes. Keep tone natural and conversational.'
          sentences = await generateWordSentences({
            word,
            topic: island.topic,
            level: baseLevel,
            detailedLevel,
            grammarTarget,
            grammarTags: grammarTags.length > 0 ? grammarTags : undefined,
            knownWords,
            wordIndex: index,
            totalWords: insertedWords.length,
            retryHint,
            generationConfig: retryConfigs[attempt],
          })
          break
        } catch (error) {
          if (attempt === retryConfigs.length - 1) {
            console.error(
              `Error generating sentences for ${word.hanzi}:`,
              error
            )
          }
        }
      }

      if (!sentences) {
        skippedWords.push(word.hanzi)
        await supabase.from('island_words').delete().eq('id', word.id)
        return
      }

      const sentencesToInsert = sentences.map((sentence) => ({
        island_id: islandId,
        word_id: word.id,
        user_id: user.id,
        tier: sentence.tier,
        hanzi: sanitizeSentenceText(sentence.hanzi),
        pinyin: sanitizeSentenceText(sentence.pinyin),
        english: sanitizeSentenceText(sentence.english),
        grammar_tag: sentence.grammarTag || null,
      }))

      const { error: sentenceError } = await supabase
        .from('island_sentences')
        .insert(sentencesToInsert)

      if (sentenceError) {
        console.error('Error inserting sentences:', sentenceError)
        skippedWords.push(word.hanzi)
        await supabase.from('island_words').delete().eq('id', word.id)
      }
      }
    })

    await limitConcurrency(sentenceTasks, 5)

    const skippedSet = new Set(skippedWords)
    const insertedWordsWithSentences = insertedWords.filter(
      (word) => !skippedSet.has(word.hanzi)
    )

    return NextResponse.json({
      insertedCount: insertedWordsWithSentences.length,
      insertedWords: insertedWordsWithSentences,
      skippedWords: Array.from(skippedSet),
    })
  } catch (error) {
    console.error('Error in POST /api/islands/[id]/add-words:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

