// Shared by the client (checkbox copy) and server (consent audit record).
// Bump a version whenever its text changes materially.

export const SMS_CONSENT_VERSION = "2026-11-04";

export const SMS_CONSENT_TEXT =
  "Yes, text me. I agree to receive recurring automated Mandarin practice messages from LingoIsland at this number. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help. Consent is optional and not required to use LingoIsland.";

export type SmsConsentSource = "onboarding" | "account_settings";

export function isSmsConsentSource(value: unknown): value is SmsConsentSource {
  return value === "onboarding" || value === "account_settings";
}

export type MessagingChannel = "sms" | "whatsapp";

export function isMessagingChannel(value: unknown): value is MessagingChannel {
  return value === "sms" || value === "whatsapp";
}

/** Onboarding asks for each message type separately. */
export const MESSAGING_CONSENT_VERSION = "2026-11-07";

export const MESSAGING_CONSENT_SCHEDULED_TEXT =
  "Send me scheduled Mandarin practice invitations from Huahua, following the schedule I choose.";

export const MESSAGING_CONSENT_JOURNEY_TEXT =
  "Send me a follow-up practice message from Huahua after I finish a Journey lesson.";

export function messagingDisclosure(channel: MessagingChannel) {
  const where = channel === "whatsapp" ? "WhatsApp" : "text message";
  const stop = channel === "whatsapp" ? "Reply STOP" : "Reply STOP to unsubscribe or HELP for help";
  return `Messages come from LingoIsland and Huahua by ${where}. Huahua is an AI Mandarin practice buddy. How often Huahua messages you follows your learning schedule. Message and data rates may apply. You can pause or stop anytime (${stop}). Consent is optional and not required to purchase.`;
}

export type ConsentSelection = {
  consentVersion: unknown;
  consent?: unknown;
  consentScheduled?: unknown;
  consentJourney?: unknown;
};

export type ConsentDecision =
  | { ok: true; version: string; scheduled: boolean; journey: boolean }
  | { ok: false };

/**
 * Accepts the single account-settings consent (both message types) or the
 * onboarding consents, where at least one type must be chosen.
 */
export function resolveConsent(input: ConsentSelection): ConsentDecision {
  if (input.consentVersion === SMS_CONSENT_VERSION) {
    return input.consent === true ? { ok: true, version: SMS_CONSENT_VERSION, scheduled: true, journey: true } : { ok: false };
  }
  if (input.consentVersion === MESSAGING_CONSENT_VERSION) {
    const scheduled = input.consentScheduled === true;
    const journey = input.consentJourney === true;
    if (!scheduled && !journey) return { ok: false };
    return { ok: true, version: MESSAGING_CONSENT_VERSION, scheduled, journey };
  }
  return { ok: false };
}
