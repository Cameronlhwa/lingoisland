import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getOriginFromRequest } from '@/lib/utils/origin'

/**
 * Auth callback route
 * Handles redirects from Supabase after:
 * 1. Google OAuth
 * 2. Email verification (signup)
 * 3. Password reset
 * 4. Email change confirmation
 * 
 * Creates/updates user profile and redirects to /app
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  
  // Try to get 'next' from cookie first (stored before OAuth), then from URL, then default
  const nextFromCookie = request.cookies.get('oauth_next')?.value
  const nextFromUrl = requestUrl.searchParams.get('next')
  let next = nextFromCookie || nextFromUrl || '/app'
  
  // Safety check: never redirect back to /login or /onboarding after successful auth
  if (next === '/login' || next.startsWith('/onboarding')) {
    next = '/app'
  }

  // Get the origin from the incoming request (preserves localhost vs production)
  const origin = getOriginFromRequest(request)

  // Handle OAuth code exchange (Google login)
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
      // Create default profile
      await supabase.from('user_profiles').insert({
        user_id: user.id,
        cefr_level: 'B1',
      })
    }
  } 
  // Handle email verification, password reset, or email change
  else if (token_hash && type) {
    const supabase = await createClient()
    
    // Verify the token
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    })
    
    if (error) {
      console.error('[AUTH CALLBACK] Error verifying token:', error)
      const errorUrl = new URL('/login?error=verification_failed', origin)
      return NextResponse.redirect(errorUrl)
    }

    // Get the user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error('[AUTH CALLBACK] Error getting user after verification:', userError)
      const errorUrl = new URL('/login?error=verification_failed', origin)
      return NextResponse.redirect(errorUrl)
    }

    // For email verification (signup), create profile if it doesn't exist
    if (type === 'email' || type === 'signup') {
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .single()

      if (!existingProfile) {
        await supabase.from('user_profiles').insert({
          user_id: user.id,
          cefr_level: 'B1',
        })
      }
    }
    
    // For password reset, redirect to a password update page or app
    if (type === 'recovery') {
      next = '/app' // Could redirect to a password update page instead
    }
  } 
  else {
    // No code or token - this shouldn't happen, but redirect to login as fallback
    console.error('[AUTH CALLBACK] No code or token_hash found in callback')
    const loginUrl = new URL('/login', origin)
    return NextResponse.redirect(loginUrl)
  }

  // Build redirect URL using the detected origin
  const redirectUrl = new URL(next, origin)

  // Create response and clear the oauth cookies after use
  const response = NextResponse.redirect(redirectUrl)
  response.cookies.set('oauth_origin', '', { maxAge: 0, path: '/' })
  response.cookies.set('oauth_next', '', { maxAge: 0, path: '/' })
  
  return response
}
