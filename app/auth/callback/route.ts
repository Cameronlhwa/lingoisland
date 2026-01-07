import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getOriginFromRequest } from '@/lib/utils/origin'

/**
 * OAuth callback route
 * Handles the redirect from Supabase after Google OAuth
 * Creates/updates user profile and topic island if pending from onboarding
 * Then redirects to /app
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  // Try to get 'next' from cookie first (stored before OAuth), then from URL, then default
  const nextFromCookie = request.cookies.get('oauth_next')?.value
  const nextFromUrl = requestUrl.searchParams.get('next')
  let next = nextFromCookie || nextFromUrl || '/app'
  
  // Safety check: never redirect back to /login after successful auth
  if (next === '/login') {
    next = '/app'
  }

  // Get the origin from the incoming request (preserves localhost vs production)
  const origin = getOriginFromRequest(request)

  if (code) {
    const supabase = await createClient()
    
    // Exchange code for session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('[AUTH CALLBACK] Error exchanging code for session:', error)
      const errorUrl = new URL('/login?error=auth_failed', origin)
      return NextResponse.redirect(errorUrl)
    }

    // Get the user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('[AUTH CALLBACK] Error getting user after code exchange:', userError)
      const errorUrl = new URL('/login?error=auth_failed', origin)
      return NextResponse.redirect(errorUrl)
    }

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
  } else {
    // No code parameter - this shouldn't happen, but redirect to login as fallback
    const loginUrl = new URL('/login', origin)
    return NextResponse.redirect(loginUrl)
  }

  // Build redirect URL using the detected origin (not request.url which might have wrong origin)
  const redirectUrl = new URL(next, origin)

  // Create response and clear the oauth cookies after use
  const response = NextResponse.redirect(redirectUrl)
  response.cookies.set('oauth_origin', '', { maxAge: 0, path: '/' })
  response.cookies.set('oauth_next', '', { maxAge: 0, path: '/' })
  
  // Redirect to next URL or /app using the correct origin
  return response
}
