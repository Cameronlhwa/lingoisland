import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getOriginFromRequest } from '@/lib/utils/origin'
import { captureServerEvent } from '@/lib/posthog/server'

/**
 * Auth callback route
 * Handles redirects from Supabase after:
 * 1. Google OAuth
 * 2. Email verification (signup)
 * 3. Password reset
 * 4. Email change confirmation
 * 
 * Creates/updates BOTH user_profiles (app settings) AND profiles (billing)
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const error = requestUrl.searchParams.get('error')
  const error_code = requestUrl.searchParams.get('error_code')
  const error_description = requestUrl.searchParams.get('error_description')
  
  // Log OAuth errors for debugging and return early — never fall through to code exchange
  if (error) {
    console.error('[AUTH CALLBACK] OAuth error received:', {
      error,
      error_code,
      error_description,
      timestamp: new Date().toISOString(),
      url: requestUrl.href,
    })
    const origin = getOriginFromRequest(request)
    if (error_code === 'flow_state_not_found') {
      console.error('[AUTH CALLBACK] Flow state not found - session expired or cookies cleared during OAuth')
      return NextResponse.redirect(new URL('/login?error=oauth_expired', origin))
    }
    if (error_code === 'identity_already_exists') {
      // User's Google account is already a separate Supabase user — send them to sign-in directly
      return NextResponse.redirect(new URL('/login?error=identity_exists', origin))
    }
    // Any other OAuth error: redirect to login with a generic message
    return NextResponse.redirect(new URL('/login?error=oauth_failed', origin))
  }
  
  // Try to get 'next' from cookie first (stored before OAuth), then from URL, then default
  const nextFromCookie = request.cookies.get('oauth_next')?.value
  const nextFromUrl = requestUrl.searchParams.get('next')
  const rawNext = nextFromCookie || nextFromUrl || '/app'
  let next = rawNext
  try {
    next = decodeURIComponent(rawNext)
  } catch {
    next = rawNext
  }

  const isSafeInternalPath =
    next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')
  
  // Safety: never send users back to /login or thin onboarding after auth.
  // Allow public journey entry URLs under /onboarding/…
  const allowedOnboarding =
    next.startsWith('/onboarding/topic-island') ||
    next.startsWith('/onboarding/journey') ||
    next.startsWith('/onboarding/upgrade')
  const onboardingIsUnsafe =
    !isSafeInternalPath ||
    next === '/login' ||
    (next.startsWith('/onboarding') && !allowedOnboarding)
  if (onboardingIsUnsafe) {
    next = '/app'
  }

  // Get the origin from the incoming request (preserves localhost vs production)
  const origin = getOriginFromRequest(request)

  // Create a response that we'll modify with cookies
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Handle OAuth code exchange (Google login / linkIdentity)
  if (code) {
    // Exchange code for session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('[AUTH CALLBACK] Error exchanging code for session:', error)
      const errorUrl = new URL('/login?error=auth_failed', origin)
      return NextResponse.redirect(errorUrl)
    }

    // Refresh the session so that is_anonymous is updated to false after linkIdentity.
    // Without this, the JWT may still carry is_anonymous:true until the next token refresh.
    await supabase.auth.refreshSession()

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

    // Check if user_profiles exists, create if needed
    const { data: existingUserProfile, error: profileCheckError } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (profileCheckError) {
      console.error('[AUTH CALLBACK] Error checking user_profiles:', profileCheckError)
    }

    if (!existingUserProfile) {
      console.log('[AUTH CALLBACK] Creating new user_profiles for user:', user.id)
      const { error: insertError } = await supabase.from('user_profiles').insert({
        user_id: user.id,
        cefr_level: 'B1',
      })
      
      if (insertError) {
        console.error('[AUTH CALLBACK] Error creating user_profiles:', insertError)
      }

      // New user — track signup completion (Google OAuth)
      captureServerEvent({ distinctId: user.id, event: 'signup_completed', properties: { method: 'google' } }).catch(() => {})
    } else {
      console.log('[AUTH CALLBACK] User profile already exists for:', user.id)
    }

    // Check if profiles (billing) exists, create if needed
    const { data: existingProfile, error: billingCheckError } = await supabase
      .from('profiles')
      .select('id, plan')
      .eq('id', user.id)
      .maybeSingle()

    if (billingCheckError) {
      console.error('[AUTH CALLBACK] Error checking profiles:', billingCheckError)
    }

    if (!existingProfile) {
      console.log('[AUTH CALLBACK] Creating new billing profile for user:', user.id)
      const { error: insertError } = await supabase.from('profiles').insert({
        id: user.id,
        plan: 'free',
      })
      
      if (insertError) {
        console.error('[AUTH CALLBACK] Error creating billing profile:', insertError)
      }
    } else {
      console.log('[AUTH CALLBACK] Billing profile already exists. User:', user.id, 'Plan:', existingProfile.plan)
    }
  } 
  // Handle email verification, password reset, or email change
  else if (token_hash && type) {
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

    // For email verification (signup), create both profiles if they don't exist
    if (type === 'email' || type === 'signup') {
      const { data: existingUserProfile, error: profileCheckError } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (profileCheckError) {
        console.error('[AUTH CALLBACK] Error checking user_profiles:', profileCheckError)
      }

      if (!existingUserProfile) {
        console.log('[AUTH CALLBACK] Creating new user_profiles for user (email verify):', user.id)
        const { error: insertError } = await supabase.from('user_profiles').insert({
          user_id: user.id,
          cefr_level: 'B1',
        })
        
        if (insertError) {
          console.error('[AUTH CALLBACK] Error creating user_profiles:', insertError)
        }

        // New user — track signup completion (email verification)
        captureServerEvent({ distinctId: user.id, event: 'signup_completed', properties: { method: 'email', requires_verification: true } }).catch(() => {})
      }

      // Also create billing profile
      const { data: existingProfile, error: billingCheckError } = await supabase
        .from('profiles')
        .select('id, plan')
        .eq('id', user.id)
        .maybeSingle()

      if (billingCheckError) {
        console.error('[AUTH CALLBACK] Error checking profiles:', billingCheckError)
      }

      if (!existingProfile) {
        console.log('[AUTH CALLBACK] Creating new billing profile for user (email verify):', user.id)
        const { error: insertError } = await supabase.from('profiles').insert({
          id: user.id,
          plan: 'free',
        })
        
        if (insertError) {
          console.error('[AUTH CALLBACK] Error creating billing profile:', insertError)
        }
      } else {
        console.log('[AUTH CALLBACK] Billing profile already exists (email verify). User:', user.id, 'Plan:', existingProfile.plan)
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

  // Create redirect response and transfer all cookies
  const redirectResponse = NextResponse.redirect(redirectUrl)
  
  // Copy all cookies from the response we've been building
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value, cookie)
  })
  
  // Clear the oauth cookies after use
  redirectResponse.cookies.set('oauth_origin', '', { maxAge: 0, path: '/' })
  redirectResponse.cookies.set('oauth_next', '', { maxAge: 0, path: '/' })
  
  return redirectResponse
}
