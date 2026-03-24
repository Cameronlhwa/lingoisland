import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
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

// Apply to all routes except API, _next/static, _next/image, and favicon
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
