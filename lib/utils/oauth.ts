export type OAuthRedirectConfig = {
  origin: string
  redirectTo: string
  cookieOptions: string
}

function buildCookieOptions(origin: string) {
  let options = 'path=/; max-age=600; SameSite=Lax'

  try {
    const url = new URL(origin)
    const host = url.hostname
    const isLocalhost = host === 'localhost' || host.endsWith('.localhost')
    const baseHost = host.startsWith('www.') ? host.slice(4) : host

    if (!isLocalhost && baseHost.includes('.')) {
      options += `; domain=${baseHost}`
    }

    if (url.protocol === 'https:') {
      options += '; Secure'
    }
  } catch {
    // Fallback to safe defaults if origin is invalid.
  }

  return options
}

export function getOAuthRedirectConfig(): OAuthRedirectConfig {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '')
  const redirectTo = `${origin}/auth/callback`
  return {
    origin,
    redirectTo,
    cookieOptions: buildCookieOptions(origin),
  }
}

