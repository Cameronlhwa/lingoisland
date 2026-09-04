import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { hskProfileFieldsFromCefr } from '@/lib/levelBands'
import { parseHskStandard, type HskStandard } from '@/lib/utils/hsk'
import {
  HSK_STANDARD_COOKIE,
  resolveHskStandard,
} from '@/lib/hsk/standardPreference'

const PROFILE_COLUMNS =
  'cefr_level, tts_rate_sentences, tts_rate_words, character_set, hsk_standard'
const PROFILE_COLUMNS_LEGACY =
  'cefr_level, tts_rate_sentences, tts_rate_words, character_set'

type ProfileRow = {
  cefr_level?: string | null
  tts_rate_sentences?: number | null
  tts_rate_words?: number | null
  character_set?: string | null
  hsk_standard?: string | null
}

function jsonWithHskCookie(
  payload: Record<string, unknown>,
  standard: HskStandard,
  init?: { status?: number },
) {
  const response = NextResponse.json(payload, init)
  response.cookies.set(HSK_STANDARD_COOKIE, standard, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  return response
}

function toPayload(profile: ProfileRow | null, cookieStandard?: string | null) {
  const hskStandard = resolveHskStandard({
    profile: profile?.hsk_standard,
    cookie: cookieStandard,
  })
  return {
    cefrLevel: profile?.cefr_level || 'B1',
    ttsRateSentences: profile?.tts_rate_sentences || 1.0,
    ttsRateWords: profile?.tts_rate_words || 1.0,
    characterSet: profile?.character_set || 'simplified',
    hskStandard,
  }
}

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

    const cookieStore = await cookies()
    const cookieStandard = cookieStore.get(HSK_STANDARD_COOKIE)?.value ?? null

    // Get or create user profile
    const initial = await supabase
      .from('user_profiles')
      .select(PROFILE_COLUMNS)
      .eq('user_id', user.id)
      .single()
    let profile: ProfileRow | null = initial.data as ProfileRow | null
    let error = initial.error

    if (error && error.message?.includes('hsk_standard')) {
      const retry = await supabase
        .from('user_profiles')
        .select(PROFILE_COLUMNS_LEGACY)
        .eq('user_id', user.id)
        .single()
      profile = retry.data as ProfileRow | null
      error = retry.error
    }

    if (error && error.code === 'PGRST116') {
      // Profile doesn't exist, create it with default level
      const { data: newProfile, error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          cefr_level: 'B1',
          tts_rate_sentences: 1.0,
          tts_rate_words: 1.0,
          character_set: 'simplified',
        })
        .select(PROFILE_COLUMNS_LEGACY)
        .single()

      if (insertError) {
        console.error('Error creating profile:', insertError)
        return NextResponse.json(
          { error: 'Failed to create profile' },
          { status: 500 }
        )
      }

      profile = newProfile as ProfileRow | null
    } else if (error) {
      console.error('Error fetching profile:', error)
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      )
    }

    const payload = toPayload(profile, cookieStandard)
    return jsonWithHskCookie(payload, payload.hskStandard)
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
    const { cefrLevel, ttsRateSentences, ttsRateWords, characterSet, hskStandard } = body

    // Prepare update object
    const updates: {
      user_id: string
      cefr_level?: string
      tts_rate_sentences?: number
      tts_rate_words?: number
      character_set?: string
      hsk_standard?: string
      hsk_current_level?: number
      hsk_level_source?: string
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
          { error: 'Invalid level' },
          { status: 400 }
        )
      }

      updates.cefr_level = cefrLevel
      Object.assign(updates, hskProfileFieldsFromCefr(cefrLevel))
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

    // Validate and add characterSet if provided
    if (characterSet !== undefined) {
      if (typeof characterSet !== 'string') {
        return NextResponse.json(
          { error: 'Invalid character set' },
          { status: 400 }
        )
      }

      const validCharacterSets = ['simplified', 'traditional']
      if (!validCharacterSets.includes(characterSet)) {
        return NextResponse.json(
          { error: 'Invalid character set. Must be "simplified" or "traditional"' },
          { status: 400 }
        )
      }

      updates.character_set = characterSet
    }

    let requestedStandard: HskStandard | undefined
    if (hskStandard !== undefined) {
      if (hskStandard !== '2.0' && hskStandard !== '3.0') {
        return NextResponse.json(
          { error: 'Invalid HSK standard. Must be "2.0" or "3.0"' },
          { status: 400 }
        )
      }
      requestedStandard = hskStandard
      updates.hsk_standard = hskStandard
    }

    // Update or insert profile
    const upserted = await supabase
      .from('user_profiles')
      .upsert(updates, {
        onConflict: 'user_id',
      })
      .select(PROFILE_COLUMNS)
      .single()
    let profile: ProfileRow | null = upserted.data as ProfileRow | null
    let error = upserted.error

    if (error && updates.hsk_standard) {
      const { hsk_standard: _ignored, ...withoutStandard } = updates
      const retry = await supabase
        .from('user_profiles')
        .upsert(withoutStandard, { onConflict: 'user_id' })
        .select(PROFILE_COLUMNS_LEGACY)
        .single()
      profile = retry.data as ProfileRow | null
      error = retry.error
    }

    if (error) {
      console.error('Error updating profile:', error)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    const cookieStore = await cookies()
    const payload = toPayload(
      {
        ...profile,
        hsk_standard: requestedStandard ?? profile?.hsk_standard,
      },
      cookieStore.get(HSK_STANDARD_COOKIE)?.value,
    )
    return jsonWithHskCookie(payload, payload.hskStandard)
  } catch (error) {
    console.error('Error in PATCH /api/profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
