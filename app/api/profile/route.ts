import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * GET /api/profile
 * Get user profile including default level
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get or create user profile
    let { data: profile, error } = await supabase
      .from('user_profiles')
      .select('cefr_level, tts_rate_sentences, tts_rate_words')
      .eq('user_id', user.id)
      .single()

    if (error && error.code === 'PGRST116') {
      // Profile doesn't exist, create it with default level
      const { data: newProfile, error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          cefr_level: 'B1',
          tts_rate_sentences: 1.0,
          tts_rate_words: 1.0,
        })
        .select('cefr_level, tts_rate_sentences, tts_rate_words')
        .single()

      if (insertError) {
        console.error('Error creating profile:', insertError)
        return NextResponse.json(
          { error: 'Failed to create profile' },
          { status: 500 }
        )
      }

      profile = newProfile
    } else if (error) {
      console.error('Error fetching profile:', error)
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      cefrLevel: profile?.cefr_level || 'B1',
      ttsRateSentences: profile?.tts_rate_sentences || 1.0,
      ttsRateWords: profile?.tts_rate_words || 1.0,
    })
  } catch (error) {
    console.error('Error in GET /api/profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/profile
 * Update user profile (default level)
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { cefrLevel, ttsRateSentences, ttsRateWords } = body

    // Prepare update object
    const updates: {
      user_id: string
      cefr_level?: string
      tts_rate_sentences?: number
      tts_rate_words?: number
    } = {
      user_id: user.id,
    }

    // Validate and add cefrLevel if provided
    if (cefrLevel !== undefined) {
      if (typeof cefrLevel !== 'string') {
        return NextResponse.json({ error: 'Invalid level' }, { status: 400 })
      }

      const validLevels = ['A1', 'A2', 'B1', 'B2', 'C1']
      if (!validLevels.includes(cefrLevel)) {
        return NextResponse.json(
          { error: 'Invalid CEFR level' },
          { status: 400 }
        )
      }

      updates.cefr_level = cefrLevel
    }

    // Validate and add ttsRateSentences if provided
    if (ttsRateSentences !== undefined) {
      if (typeof ttsRateSentences !== 'number') {
        return NextResponse.json(
          { error: 'Invalid TTS rate for sentences' },
          { status: 400 }
        )
      }

      // Clamp to valid range
      const clampedSentences = Math.max(0.25, Math.min(2.0, ttsRateSentences))
      updates.tts_rate_sentences = Math.round(clampedSentences * 100) / 100
    }

    // Validate and add ttsRateWords if provided
    if (ttsRateWords !== undefined) {
      if (typeof ttsRateWords !== 'number') {
        return NextResponse.json(
          { error: 'Invalid TTS rate for words' },
          { status: 400 }
        )
      }

      // Clamp to valid range
      const clampedWords = Math.max(0.25, Math.min(2.0, ttsRateWords))
      updates.tts_rate_words = Math.round(clampedWords * 100) / 100
    }

    // Update or insert profile
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .upsert(updates, {
        onConflict: 'user_id',
      })
      .select('cefr_level, tts_rate_sentences, tts_rate_words')
      .single()

    if (error) {
      console.error('Error updating profile:', error)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      cefrLevel: profile.cefr_level,
      ttsRateSentences: profile.tts_rate_sentences,
      ttsRateWords: profile.tts_rate_words,
    })
  } catch (error) {
    console.error('Error in PATCH /api/profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
