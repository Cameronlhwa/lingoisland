import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * OAuth callback route
 * Handles the redirect from Supabase after Google OAuth
 * Creates/updates user profile and topic island if pending from onboarding
 * Then redirects to /app
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/app'

  if (code) {
    const supabase = await createClient()
    
    // Exchange code for session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('Error exchanging code for session:', error)
      return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
    }

    // Get the user
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      // Check if profile exists, create/update if needed
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .single()

      if (!existingProfile) {
        // Create default profile (CEFR level will be updated from onboarding if needed)
        await supabase.from('user_profiles').insert({
          user_id: user.id,
          cefr_level: 'B1', // Default, can be overridden by onboarding
        })
      }

      // Handle pending topic island request from onboarding
      // Note: We can't access localStorage here (server-side), so we'll handle it client-side
      // The /app page will check for pending requests and create the topic island
    }
  }

  // Redirect to next URL or /app
  return NextResponse.redirect(new URL(next, request.url))
}
