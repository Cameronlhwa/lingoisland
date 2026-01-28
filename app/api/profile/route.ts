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
      .select('cefr_level')
      .eq('user_id', user.id)
      .single()

    if (error && error.code === 'PGRST116') {
      // Profile doesn't exist, create it with default level
      const { data: newProfile, error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          cefr_level: 'B1',
        })
        .select('cefr_level')
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

    return NextResponse.json({ cefrLevel: profile?.cefr_level || 'B1' })
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
    const { cefrLevel } = body

    if (!cefrLevel || typeof cefrLevel !== 'string') {
      return NextResponse.json(
        { error: 'Invalid level' },
        { status: 400 }
      )
    }

    // Validate level
    const validLevels = ['A1','A2', 'B1', 'B2', 'C1']
    if (!validLevels.includes(cefrLevel)) {
      return NextResponse.json(
        { error: 'Invalid CEFR level' },
        { status: 400 }
      )
    }

    // Update or insert profile
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .upsert(
        {
          user_id: user.id,
          cefr_level: cefrLevel,
        },
        {
          onConflict: 'user_id',
        }
      )
      .select('cefr_level')
      .single()

    if (error) {
      console.error('Error updating profile:', error)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({ cefrLevel: profile.cefr_level })
  } catch (error) {
    console.error('Error in PATCH /api/profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
