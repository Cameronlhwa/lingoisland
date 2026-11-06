// Shared by the client (checkbox copy) and server (consent audit record).
// Bump SMS_CONSENT_VERSION whenever SMS_CONSENT_TEXT changes materially.

export const SMS_CONSENT_VERSION = "2026-11-04";

export const SMS_CONSENT_TEXT =
  "Yes, text me. I agree to receive recurring automated Mandarin practice messages from LingoIsland at this number. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help. Consent is optional and not required to use LingoIsland.";

export type SmsConsentSource = "onboarding" | "account_settings";

export function isSmsConsentSource(value: unknown): value is SmsConsentSource {
  return value === "onboarding" || value === "account_settings";
}
