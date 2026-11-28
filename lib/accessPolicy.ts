/** Onboarding trials and setup run before purchase; their handlers retain task, session, and usage checks. */
export type RequiredProduct = "core" | "hsk" | "either";
// Exact paths only: adding a general onboarding/HSK prefix would expose full lessons.
export const PRE_PURCHASE_ONBOARDING_APIS = [
  "/api/onboarding/progress", "/api/onboarding/abandon", "/api/onboarding/save-email", "/api/onboarding/insight",
  "/api/onboarding/pronunciation", "/api/onboarding/first-lesson", "/api/onboarding/writing",
  "/api/hsk/placement-checklist", "/api/hsk/onboarding-answers", "/api/hsk/curriculum/generate",
] as const;
const PUBLIC_APIS = new Set<string>([
  ...PRE_PURCHASE_ONBOARDING_APIS,
  "/api/entitlements", "/api/profile", "/api/app-side", "/api/subscription-status",
  "/api/auth/confirm-for-checkout", "/api/billing/cancellation-feedback",
  "/api/stripe/checkout", "/api/stripe/portal", "/api/stripe/reconcile", "/api/stripe/sync", "/api/stripe/webhook",
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
