import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function isProtectedHskApi(pathname: string): boolean {
  if (pathname.startsWith('/api/hsk/')) {
    // These endpoints support the pre-checkout onboarding preview / setup. They
    // cannot unlock app routes or other HSK API endpoints.
    if (pathname === '/api/hsk/journey/generate') return false
    if (pathname === '/api/hsk/curriculum/generate') return false
    if (pathname === '/api/hsk/onboarding-answers') return false
    if (pathname === '/api/hsk/placement-checklist') return false
    return true
  }
  return false
}

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''
  
  // Redirect www to non-www
  if (hostname.startsWith('www.')) {
    const newUrl = new URL(request.url)
    newUrl.hostname = hostname.replace('www.', '')
    return NextResponse.redirect(newUrl, 301)
  }
  
  // Redirect http to https in production
  const proto = request.headers.get('x-forwarded-proto')
  if (proto === 'http' && hostname.includes('lingoisland.com')) {
    const newUrl = new URL(request.url)
    newUrl.protocol = 'https:'
    return NextResponse.redirect(newUrl, 301)
  }

  if (isProtectedHskApi(request.nextUrl.pathname)) {
    // HSK APIs are paid-only. Islands APIs intentionally remain available to
    // signed-in free users, whose limits are enforced in their route handlers.
    const entitlementsUrl = new URL('/api/entitlements', request.url)
    const entitlementsResponse = await fetch(entitlementsUrl, {
      headers: {
        cookie: request.headers.get('cookie') ?? '',
        'x-product-access-check': '1',
      },
      cache: 'no-store',
    }).catch(() => null)

    if (!entitlementsResponse?.ok) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: entitlementsResponse?.status === 401 ? 401 : 503 },
      )
    }

    const entitlements = (await entitlementsResponse.json()) as {
      isIslandsPro?: boolean
      isHskPro?: boolean
    }
    if (!entitlements.isHskPro) {
      return NextResponse.json(
        {
          error: 'An HSK Prep subscription is required',
          code: 'PRODUCT_ACCESS_REQUIRED',
          product: 'hsk',
        },
        { status: 403 },
      )
    }
  }

  // So /app/* server layout can send users to login?next=<intended path> (incl. query).
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(
    'x-login-next',
    request.nextUrl.pathname + request.nextUrl.search,
  )
  return NextResponse.next({
    request: { headers: requestHeaders },
  })
}

// Apply to app routes and API routes, excluding static assets.
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
