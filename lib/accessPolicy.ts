/** Setup, billing, and the authenticated onboarding pronunciation trial stay reachable before purchase. */
export type RequiredProduct = "core" | "hsk" | "either";
const PUBLIC_APIS = new Set([
  "/api/entitlements", "/api/profile", "/api/app-side", "/api/subscription-status",
  "/api/auth/confirm-for-checkout", "/api/billing/cancellation-feedback",
  "/api/stripe/checkout", "/api/stripe/portal", "/api/stripe/reconcile", "/api/stripe/sync", "/api/stripe/webhook",
  "/api/onboarding/progress", "/api/onboarding/abandon", "/api/onboarding/save-email", "/api/onboarding/insight",
  "/api/onboarding/pronunciation",
  "/api/hsk/waitlist",
  "/api/sms/webhook",
]);
export function requiredApiProduct(pathname: string): RequiredProduct | null {
  const path = pathname.replace(/\/+$/, "");
  if (!path.startsWith("/api/")) return null;
  if (PUBLIC_APIS.has(path)) return null;
  // Each of these infrastructure namespaces has its own administrator/secret authentication.
  if (["/api/admin/", "/api/internal/", "/api/cron/"].some(prefix => path.startsWith(prefix))) return null;
  if (path.startsWith("/api/hsk/")) return "hsk";
  if (path.startsWith("/api/sms/") || path.startsWith("/api/pronunciation/") || ["/api/tts", "/api/pinyin", "/api/chinese"].includes(path)) return "either";
  return "core";
}
export function permitsProduct(access: {isIslandsPro?: boolean; isHskPro?: boolean}, product: RequiredProduct): boolean {
  return product === "either" ? access.isIslandsPro === true || access.isHskPro === true
    : product === "hsk" ? access.isHskPro === true : access.isIslandsPro === true;
}
