import { requiredApiProduct, permitsProduct } from '@/lib/accessPolicy'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

  const requiredProduct = requiredApiProduct(request.nextUrl.pathname)
  if (requiredProduct) {
    // This check runs before handlers can read learning data or spend model/audio credits.
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

    const entitlements = await entitlementsResponse.json().catch(() => null) as {
      isIslandsPro?: boolean
      isHskPro?: boolean
    } | null
    if (!entitlements || !permitsProduct(entitlements, requiredProduct)) {
      return NextResponse.json(
        {
          error: 'A subscription is required to access learning features',
          code: 'PRODUCT_ACCESS_REQUIRED',
          product: requiredProduct,
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
