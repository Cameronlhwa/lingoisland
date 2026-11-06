import { getOriginFromRequest } from "@/lib/utils/origin";

/**
 * CSRF guard for cookie-authenticated JSON mutations. Browsers always send
 * Origin on cross-site POST/PATCH/DELETE, and a JSON content type cannot be
 * sent cross-site without a CORS preflight we never approve.
 */
export function isSameOriginMutation(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;

  const origin = request.headers.get("origin");
  if (origin) {
    const allowed = new Set([getOriginFromRequest(request)]);
    try {
      allowed.add(new URL(request.url).origin);
    } catch {
      // ignore malformed request URLs
    }
    if (!allowed.has(origin)) return false;
  } else if (!fetchSite) {
    // Neither header: not a modern browser request we can vouch for.
    return false;
  }

  if (request.method !== "DELETE") {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("application/json")) return false;
  }
  return true;
}
