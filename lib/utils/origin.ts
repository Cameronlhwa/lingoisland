/**
 * Utility to get the application origin consistently across browser and server contexts.
 * 
 * This ensures redirects preserve the origin where the login was initiated,
 * preventing localhost -> production redirect bugs.
 */

/**
 * Get the origin from a Next.js request.
 * Safely handles x-forwarded-host and x-forwarded-proto headers for proxied requests.
 */
export function getOriginFromRequest(request: {
  url?: string;
  headers: Headers | { get: (name: string) => string | null };
}): string {
  // Get headers (works with both Headers object and object with get method)
  const getHeader = (name: string): string | null => {
    if ('get' in request.headers) {
      return request.headers.get(name);
    }
    return null;
  };

  // PRIORITY 1: Check for forwarded headers (common in proxied environments like Vercel)
  // These are the most reliable as they reflect the actual client request
  const forwardedHost = getHeader('x-forwarded-host');
  const forwardedProto = getHeader('x-forwarded-proto');
  
  if (forwardedHost) {
    // Use forwarded headers if available
    // Default to https if not specified (common in production)
    const protocol = forwardedProto === 'http' ? 'http' : 'https';
    return `${protocol}://${forwardedHost}`;
  }

  // PRIORITY 2: Use host header (direct request, not proxied)
  const host = getHeader('host');
  if (host) {
    // Determine protocol:
    // - In development, Next.js typically uses http
    // - In production, assume https unless explicitly http
    // - Check x-forwarded-proto as a hint even if x-forwarded-host is missing
    const protoHint = getHeader('x-forwarded-proto');
    const protocol = protoHint === 'http' 
      ? 'http' 
      : (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    return `${protocol}://${host}`;
  }

  // PRIORITY 3: Try request.url as fallback (but this might have wrong origin)
  if (request.url) {
    try {
      const url = new URL(request.url);
      return url.origin;
    } catch {
      // Invalid URL, fall through
    }
  }

  // PRIORITY 4: Last resort: use environment variable
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }

  throw new Error(
    'Could not determine origin from request. Ensure x-forwarded-host or host header is present.'
  );
}

/**
 * Get the app origin in browser context.
 */
export function getAppOrigin(): string {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  throw new Error('getAppOrigin() called in non-browser context. Use getOriginFromRequest() on server.');
}

