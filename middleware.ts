import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { getOriginFromRequest } from '@/lib/utils/origin'

/**
 * Middleware to protect /app routes
 * Checks for valid session and redirects to /login if not authenticated
 * Also handles OAuth codes redirected to root (when Supabase ignores redirectTo)
 */
export async function middleware(request: NextRequest) {
  // Handle OAuth codes at root path (when Supabase ignores redirectTo)
  // Supabase may redirect to /?code=... instead of /auth/callback?code=...
  if (request.nextUrl.pathname === '/' && request.nextUrl.searchParams.has('code')) {
    const origin = getOriginFromRequest(request)
    const code = request.nextUrl.searchParams.get('code')
    // Try to get next from cookie first (stored before OAuth), then from URL, then default
    const nextFromCookie = request.cookies.get('oauth_next')?.value
    const nextFromUrl = request.nextUrl.searchParams.get('next')
    const next = nextFromCookie || nextFromUrl || '/app'
    
    const callbackUrl = new URL('/auth/callback', origin)
    callbackUrl.searchParams.set('code', code!)
    if (next) {
      callbackUrl.searchParams.set('next', next)
    }
    
    return NextResponse.redirect(callbackUrl)
  }

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
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
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
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
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

  // Refresh session if expired
  await supabase.auth.getUser()

  // Protect /app routes
  if (request.nextUrl.pathname.startsWith('/app')) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

