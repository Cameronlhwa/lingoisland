import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateWordList } from '@/lib/deepseek/generate-word-list'
import { generateWordSentences, type Word } from '@/lib/deepseek/generate-word-sentences'
import { limitConcurrency } from '@/lib/utils/concurrency'
import { getEntitlements } from '@/lib/entitlements'
import { generateGrammarFocus } from '@/lib/deepseek/generate-grammar-focus'
import { normalizeSentenceStyle } from '@/lib/sentenceStyle'

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
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      )
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const dbClient = supabase

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

    // Get user entitlements for paywall enforcement
    const entitlements = await getEntitlements(user.id)

    const apiKey = process.env.DEEPSEEK_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json(
        { error: 'DEEPSEEK_API_KEY not configured' },
        { status: 500 }
      )
    }

    // Prevent concurrent generation jobs for the same island
    if (island.status === 'generating' || island.status === 'selecting') {
      return NextResponse.json({
        message: 'Generation already in progress',
        status: 'generating' as const,
      })
    }

    // Parse request body for review vocab configuration
    const body = await request.json().catch(() => ({}))
    const reviewVocabConfig = body.reviewVocab as
      | { mode: 'random' | 'select'; islandIds?: string[] }
      | undefined
    const sentenceTierMode =
      body.sentenceTierMode === 'easy_same' ? 'easy_same' : 'full'
    // Curriculum-unit islands seed their island_words at build time; skip the
    // DeepSeek word-list step and go straight to sentence generation.
    const wordsPreseeded = body.wordsPreseeded === true

    // Update status to selecting
    await supabase
      .from('topic_islands')
      .update({ status: 'selecting' })
      .eq('id', islandId)

    // Fetch known words based on review vocab configuration
    let knownWords: string[] = []
    
    if (reviewVocabConfig) {
      // User explicitly wants review vocabulary
      if (reviewVocabConfig.mode === 'select' && reviewVocabConfig.islandIds && reviewVocabConfig.islandIds.length > 0) {
        // Fetch words from specific selected islands
        const { data: knownWordsData } = await supabase
          .from('island_words')
          .select('hanzi')
          .eq('user_id', user.id)
          .in('island_id', reviewVocabConfig.islandIds)
          .order('created_at', { ascending: false })
          .limit(50)

        const candidateKnownWords = knownWordsData?.map((w) => w.hanzi) || []
        knownWords = candidateKnownWords
          .sort(() => 0.5 - Math.random())
          .slice(0, Math.min(8, candidateKnownWords.length))
      } else if (reviewVocabConfig.mode === 'random') {
        // Fetch words randomly from all other islands
        const { data: knownWordsData } = await supabase
          .from('island_words')
          .select('hanzi')
          .eq('user_id', user.id)
          .neq('island_id', islandId)
          .order('created_at', { ascending: false })
          .limit(50)

        const candidateKnownWords = knownWordsData?.map((w) => w.hanzi) || []
        knownWords = candidateKnownWords
          .sort(() => 0.5 - Math.random())
          .slice(0, Math.min(8, candidateKnownWords.length))
      }
    }
    // If no review vocab config, knownWords remains empty array

    // Map stored level to base band for validation
    const mapToBaseLevel = (level: string | null): 'A1' | 'A2' | 'B1' | 'B2' | 'C1' => {
      if (!level) return 'B1'
      // A0 (true beginner) uses A1 generation prompts
      if (level.startsWith('A0') || level.startsWith('A1')) return 'A1'
      if (level.startsWith('A2')) return 'A2'
      if (level.startsWith('B1')) return 'B1'
      if (level.startsWith('B2')) return 'B2'
      if (level.startsWith('C1')) return 'C1'
      return 'B1'
    }

    const baseLevel = mapToBaseLevel(island.level as string)
    const detailedLevel = island.level as string
    const grammarTarget = island.grammar_target || 0
    const sentenceStyle = normalizeSentenceStyle(
      body.sentenceStyle ?? island.sentence_style,
    )

    const tiersPerWord = sentenceTierMode === 'easy_same' ? 2 : 3
    const sentenceTasksTotal = island.word_target * tiersPerWord
    let wordsSelected = 0
    let sentencesGenerated = 0
    let sentenceAttempts = 0

    let lastProgressUpdateAt = 0
    const updateProgress = async (updates: Partial<{
      wordsSelected: number
      sentencesGenerated: number
      sentenceAttempts: number
      status: 'selecting' | 'generating' | 'ready' | 'error'
    }>, force = false) => {
      const now = Date.now()
      if (!force && now - lastProgressUpdateAt < 800) {
        return
      }
      lastProgressUpdateAt = now
      if (updates.wordsSelected !== undefined) {
        wordsSelected = updates.wordsSelected
      }
      if (updates.sentencesGenerated !== undefined) {
        sentencesGenerated = updates.sentencesGenerated
      }
      if (updates.sentenceAttempts !== undefined) {
        sentenceAttempts = updates.sentenceAttempts
      }

      await dbClient
        .from('topic_islands')
        .update({
          status: updates.status || island.status,
          words_selected: wordsSelected,
          sentences_generated: sentencesGenerated,
          sentence_attempts: Math.min(sentenceAttempts, sentenceTasksTotal),
          sentence_tasks: sentenceTasksTotal,
        })
        .eq('id', islandId)
    }

      // Check current count
      const { count: currentCount } = await supabase
        .from('island_words')
        .select('*', { count: 'exact', head: true })
        .eq('island_id', islandId)

      const currentWords = currentCount || 0
    wordsSelected = currentWords

    const { count: currentSentenceCount } = await supabase
      .from('island_sentences')
      .select('*', { count: 'exact', head: true })
      .eq('island_id', islandId)

    sentencesGenerated = currentSentenceCount || 0
    sentenceAttempts = sentencesGenerated

    await updateProgress({
      wordsSelected,
      sentencesGenerated,
      sentenceAttempts,
      status: 'selecting',
    }, true)

      // If we've reached the target, mark as ready and return. For pre-seeded
      // islands the words are always all present up front, so only short-circuit
      // once their sentences exist too.
      const preseededSentencesDone =
        wordsPreseeded && sentencesGenerated >= currentWords * tiersPerWord
      if (
        currentWords >= island.word_target &&
        (!wordsPreseeded || preseededSentencesDone)
      ) {
        await supabase
          .from('topic_islands')
          .update({ status: 'ready' })
          .eq('id', islandId)

        return NextResponse.json({
        addedWords: 0,
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

    // Calculate how many words we need
    const wordsNeeded = island.word_target - currentWords

    // Get current max position to continue numbering
    const { data: maxPositionData } = await supabase
      .from('island_words')
      .select('position')
      .eq('island_id', islandId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle()

    let currentPosition = (maxPositionData?.position || 0)

    // STAGE 1: Generate word list upfront — unless the island's words were
    // pre-seeded (curriculum-unit islands seed island_words at build time).
    let wordList: Word[] = []
    if (!wordsPreseeded) {
      try {
        wordList = await generateWordList({
          topic: island.topic,
          level: baseLevel,
          detailedLevel,
          wordCount: wordsNeeded,
          existingWords,
        })
      } catch (error) {
        console.error('Word list generation error:', error)
        await supabase
          .from('topic_islands')
          .update({ status: 'error' })
          .eq('id', islandId)

        return NextResponse.json(
          {
            error: 'Failed to generate word list',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
          { status: 500 }
        )
      }
    }

    // ── Fire grammar focus in the background — don't block word/sentence generation ──
    const grammarFocusPromise: Promise<void> = grammarTarget > 0
      ? (async () => {
          try {
            const { data: recentGrammar } = await supabase
              .from('island_grammar_focus')
              .select('hanzi')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(10)
            const recentPatterns = Array.from(new Set(recentGrammar?.map(g => g.hanzi) || []))
            const varietyHint = `${Date.now()}-${userId?.slice(0, 8)}`
            const grammarFocusResult = await generateGrammarFocus({
              topic: island.topic,
              level: baseLevel,
              detailedLevel,
              grammarCount: grammarTarget,
              varietyHint,
              recentPatterns,
            })
            for (let i = 0; i < grammarFocusResult.points.length; i++) {
              const point = grammarFocusResult.points[i]
              const { data: gf, error: gfErr } = await supabase
                .from('island_grammar_focus')
                .insert({
                  island_id: islandId,
                  user_id: user.id,
                  hanzi: point.hanzi,
                  pinyin: point.pinyin,
                  english: point.english,
                  pattern: point.pattern,
                  when_to_use: point.whenToUse || null,
                  position: i + 1,
                })
                .select()
                .single()
              if (gfErr || !gf) { console.error('grammar_focus insert', gfErr); continue }
              await Promise.all(point.examples.map(ex =>
                dbClient.from('island_grammar_examples').insert({
                  grammar_focus_id: gf.id,
                  tier: ex.tier,
                  hanzi: ex.hanzi,
                  pinyin: ex.pinyin,
                  english: ex.english,
                })
              ))
            }
          } catch (err) {
            console.error('grammar focus generation failed (non-fatal):', err)
          }
        })()
      : Promise.resolve()

    // ── Insert all words in parallel (or load the pre-seeded ones) ──
    const insertedWords: Array<Word & { id: string; position: number }> = []

    if (wordsPreseeded) {
      const { data: seededRows } = await dbClient
        .from('island_words')
        .select('id, hanzi, pinyin, english, position')
        .eq('island_id', islandId)
        .order('position', { ascending: true })
      for (const row of seededRows ?? []) {
        insertedWords.push({
          id: row.id as string,
          hanzi: row.hanzi as string,
          pinyin: row.pinyin as string,
          english: row.english as string,
          position: (row.position as number) ?? insertedWords.length + 1,
        })
      }
    } else {
      const wordInsertPromises = wordList.map((word, index) => {
        const position = currentPosition + index + 1
        return dbClient
          .from('island_words')
          .insert({
            island_id: islandId,
            user_id: user.id,
            hanzi: word.hanzi,
            pinyin: word.pinyin,
            english: word.english,
            difficulty_tag: 'core',
            position,
          })
          .select()
          .single()
          .then(({ data, error }) => ({ word, position, data, error }))
      })

      const wordResults = await Promise.allSettled(wordInsertPromises)

      for (const result of wordResults) {
        if (result.status === 'rejected') {
          console.error('Word insert promise rejected:', result.reason)
          continue
        }
        const { word, position, data: wordData, error: wordError } = result.value
        if (wordError) {
          if ((wordError as any).code === '23503') {
            console.error('Island deleted during word insert (FK error). Stopping.')
            break
          }
          console.error('Error inserting word:', wordError)
          continue
        }
        if (wordData) {
          insertedWords.push({ ...word, id: wordData.id, position })
        }
      }
      currentPosition += wordList.length
    }
    // Pre-seeded islands already counted their words in `currentWords`.
    const totalWordsSelected = wordsPreseeded
      ? currentWords
      : currentWords + insertedWords.length
    await updateProgress({ wordsSelected: totalWordsSelected, status: 'selecting' })

    // All words generate sentences (position-based paywall removed)
    const wordsToGenerate = insertedWords

    if (insertedWords.length === 0) {
      // No words were inserted, mark as error
      await supabase
        .from('topic_islands')
        .update({ status: 'error' })
        .eq('id', islandId)

      return NextResponse.json(
        {
          error: 'Failed to insert words',
          message: 'No words could be inserted into the database',
        },
        { status: 500 }
      )
    }

    // STAGE 2: Generate sentences in parallel (max 5 concurrent)
    // Ensure supabase is not null (it shouldn't be at this point, but TypeScript needs this)
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection lost' },
        { status: 500 }
      )
    }

    await updateProgress({
      wordsSelected: totalWordsSelected,
      status: 'generating',
    }, true)

    const SENTENCE_STYLES = [
      'chat reply',
      'rhetorical question',
      'mild complaint',
      'suggestion/advice',
      'teasing joke',
      'mini dialogue',
      'short narration',
    ]

    const CONTEXTS = [
      'friends/chat',
      'school',
      'work',
      'dating',
      'food',
      'gym',
      'commuting',
      'online shopping',
      'gaming',
      'bills',
      'family',
    ]

    const MAX_RECENT_OPENERS = 25
    const MAX_RECENT_PATTERNS = 40
    const recentOpeners: string[] = []
    const recentOpenersSet = new Set<string>()
    const recentPatterns: string[] = []
    const recentPatternsSet = new Set<string>()
    const normalizedSentences: string[] = []

    let banlistLock = Promise.resolve()
    const withBanlistLock = async <T,>(fn: () => Promise<T> | T): Promise<T> => {
      const run = banlistLock.then(fn, fn)
      banlistLock = run.then(
        () => undefined,
        () => undefined
      )
      return run
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

    const normalizeSentence = (sentence: string) =>
      sentence.replace(/[，。？！、\s]/g, '')

    const getOpener = (sentence: string) => {
      const cleaned = sentence.replace(/^[“”"']/, '').trim()
      const stopIndex = cleaned.search(/[，。？！]/)
      const sliceEnd = stopIndex > 0 ? stopIndex : Math.min(8, cleaned.length)
      return cleaned.slice(0, sliceEnd)
    }

    const hasNaturalPunctuation = (sentence: string) => /[，。？！]/.test(sentence)

    const getBigrams = (sentence: string) => {
      const normalized = normalizeSentence(sentence)
      const bigrams = new Set<string>()
      for (let i = 0; i < normalized.length - 1; i++) {
        bigrams.add(normalized.slice(i, i + 2))
      }
      return bigrams
    }

    const jaccardSimilarity = (a: Set<string>, b: Set<string>) => {
      if (a.size === 0 || b.size === 0) return 0
      let intersection = 0
      for (const item of Array.from(a)) {
        if (b.has(item)) intersection++
      }
      const union = a.size + b.size - intersection
      return union === 0 ? 0 : intersection / union
    }

    const isNearDuplicate = (sentence: string) => {
      const currentBigrams = getBigrams(sentence)
      return normalizedSentences.some((existing) => {
        const existingBigrams = getBigrams(existing)
        return jaccardSimilarity(currentBigrams, existingBigrams) > 0.7
      })
    }

    const sanitizeSentenceText = (text: string) =>
      text.replace(/^[\s\-–—•]+/, '').replace(/^["'“”]+/, '').trim()

    let progressLock = Promise.resolve()
    const withProgressLock = async <T,>(fn: () => Promise<T> | T): Promise<T> => {
      const run = progressLock.then(fn, fn)
      progressLock = run.then(
        () => undefined,
        () => undefined
      )
      return run
    }

    const sentenceGenerationTasks = wordsToGenerate.map((word, index) => {
      return async () => {
        const styleCount =
          sentenceTierMode === 'easy_same'
            ? 2
            : Math.random() < 0.5
              ? 2
              : 3
        const contextCount = Math.random() < 0.5 ? 1 : 2
        const chosenStyles = pickRandomUnique(SENTENCE_STYLES, styleCount)
        const chosenContexts = pickRandomUnique(CONTEXTS, contextCount)

        let attempt = 0
        let avoidOpeners: string[] = []
        let avoidPatterns: string[] = []

        const maxAttempts = 3
        while (attempt < maxAttempts) {
          attempt++
          let sentences
          try {
            const retryHint =
              attempt === 1
                ? undefined
                : 'Each sentence must include the target word. Do not use bullets or list prefixes. Keep tone natural and conversational.'

            const generationConfig =
              attempt === 1
                ? undefined
                : attempt === 2
                  ? {
                      temperature: 0.8,
                      topP: 0.9,
                      frequencyPenalty: 0.4,
                      presencePenalty: 0.2,
                      maxTokens: 1800,
                    }
                  : {
                      temperature: 0.7,
                      topP: 0.86,
                      frequencyPenalty: 0.3,
                      presencePenalty: 0.15,
                      maxTokens: 1600,
                    }

            sentences = await generateWordSentences({
            word,
            topic: island.topic,
            level: baseLevel,
            detailedLevel,
            knownWords: knownWords.length > 0 ? knownWords : undefined,
            wordIndex: index,
            totalWords: wordsToGenerate.length,
            styles: chosenStyles,
            contexts: chosenContexts,
            avoidOpeners: avoidOpeners.length > 0 ? avoidOpeners : undefined,
            avoidPatterns: avoidPatterns.length > 0 ? avoidPatterns : undefined,
              retryHint,
              sentenceTierMode,
              sentenceStyle,
              generationConfig,
          })
          } catch (error) {
            console.error(`Error generating sentences for word ${word.hanzi}:`, error)
            continue
          }

          await withProgressLock(async () => {
            sentenceAttempts += sentences.length
            await updateProgress(
              {
                sentenceAttempts,
                status: 'generating',
              },
              attempt === 1
            )
          })

          const validationResult = await withBanlistLock(async () => {
            const nextAvoidOpeners: string[] = []
            const nextAvoidPatterns: string[] = []

            for (const sentence of sentences) {
              sentence.hanzi = sanitizeSentenceText(sentence.hanzi)
              sentence.pinyin = sanitizeSentenceText(sentence.pinyin)
              sentence.english = sanitizeSentenceText(sentence.english)

              const opener = getOpener(sentence.hanzi)
              const normalized = normalizeSentence(sentence.hanzi)

              if (!sentence.hanzi.includes(word.hanzi)) {
                return { ok: false, avoidOpeners: [opener], avoidPatterns: [] }
              }

              const isChatReply = sentence.style === 'chat reply'
              if (!hasNaturalPunctuation(sentence.hanzi) && !isChatReply) {
                return { ok: false, avoidOpeners: [opener], avoidPatterns: [] }
              }

              if (isNearDuplicate(sentence.hanzi)) {
                nextAvoidOpeners.push(opener)
                nextAvoidPatterns.push(normalized.slice(0, 8))
              }

              if (recentOpenersSet.has(opener)) {
                nextAvoidOpeners.push(opener)
              }
            }

            if (nextAvoidOpeners.length > 0 || nextAvoidPatterns.length > 0) {
              return { ok: false, avoidOpeners: nextAvoidOpeners, avoidPatterns: nextAvoidPatterns }
            }

            for (const sentence of sentences) {
              const opener = getOpener(sentence.hanzi)
              const normalized = normalizeSentence(sentence.hanzi)
              const pattern = normalized.slice(0, 10)

              if (!recentOpenersSet.has(opener)) {
                recentOpeners.push(opener)
                recentOpenersSet.add(opener)
              }
              if (!recentPatternsSet.has(pattern)) {
                recentPatterns.push(pattern)
                recentPatternsSet.add(pattern)
              }
              normalizedSentences.push(sentence.hanzi)

              if (recentOpeners.length > MAX_RECENT_OPENERS) {
                const removed = recentOpeners.shift()
                if (removed) recentOpenersSet.delete(removed)
              }
              if (recentPatterns.length > MAX_RECENT_PATTERNS) {
                const removed = recentPatterns.shift()
                if (removed) recentPatternsSet.delete(removed)
              }
            }

            return { ok: true, avoidOpeners: [], avoidPatterns: [] }
          })

          if (!validationResult.ok && attempt < maxAttempts) {
            avoidOpeners = validationResult.avoidOpeners
            avoidPatterns = validationResult.avoidPatterns
            continue
          }
          if (!validationResult.ok && attempt >= maxAttempts) {
            // Last attempt: accept with relaxed repetition rules to avoid dropping sentences
            await withBanlistLock(async () => {
              for (const sentence of sentences) {
                const opener = getOpener(sentence.hanzi)
                const normalized = normalizeSentence(sentence.hanzi)
                const pattern = normalized.slice(0, 10)
                if (!recentOpenersSet.has(opener)) {
                  recentOpeners.push(opener)
                  recentOpenersSet.add(opener)
                }
                if (!recentPatternsSet.has(pattern)) {
                  recentPatterns.push(pattern)
                  recentPatternsSet.add(pattern)
                }
                normalizedSentences.push(sentence.hanzi)
                if (recentOpeners.length > MAX_RECENT_OPENERS) {
                  const removed = recentOpeners.shift()
                  if (removed) recentOpenersSet.delete(removed)
                }
                if (recentPatterns.length > MAX_RECENT_PATTERNS) {
                  const removed = recentPatterns.shift()
                  if (removed) recentPatternsSet.delete(removed)
                }
              }
            })
          }

          // Insert sentences for this word
          const sentencesToInsert = sentences.map((sentence) => ({
          island_id: islandId,
          word_id: word.id,
          user_id: user.id,
          tier: sentence.tier,
          hanzi: sentence.hanzi,
          pinyin: sentence.pinyin,
          english: sentence.english,
        }))

          const { error: sentenceError } = await dbClient
            .from('island_sentences')
            .insert(sentencesToInsert)

          if (sentenceError) {
            console.error(`Error inserting sentences for word ${word.hanzi}:`, sentenceError)
            return { wordId: word.id, success: false, error: sentenceError }
          }

          await withProgressLock(async () => {
            sentencesGenerated += sentences.length
            await updateProgress(
              {
                sentencesGenerated,
                status: 'generating',
              },
              sentencesGenerated >= sentenceTasksTotal
            )
          })

          return { wordId: word.id, success: true }
        }

        return { wordId: word.id, success: false, error: 'Failed validation' }
      }
    })

    // Execute sentence generation — 8 concurrent slots (was 5)
    const sentenceResults = await limitConcurrency(sentenceGenerationTasks, 8)

    // Wait for grammar focus to finish writing (it started in parallel)
    await grammarFocusPromise

    // Count successful generations
    const successfulGenerations = sentenceResults.filter((r) => r.success).length
    const failedGenerations = sentenceResults.filter((r) => !r.success).length

    if (failedGenerations > 0) {
      console.warn(
        `Failed to generate sentences for ${failedGenerations} out of ${wordsToGenerate.length} words`
      )
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
        addedWords: insertedWords.length,
        totalWords: finalTotal,
        status: 'ready' as const,
      })
    }

    // Not at target yet, mark as generating
    return NextResponse.json({
      addedWords: insertedWords.length,
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

