// Client-safe shapes for /api/sms/phone. Never include full phone numbers
// or verification codes here.

export type SmsContactStatus =
  | "unverified"
  | "active"
  | "paused"
  | "opted_out"
  | "disabled";

export type SmsSupportedCountry = { code: string; dialCode: string };

export type SmsPhoneState = {
  available: boolean;
  supportedCountries: SmsSupportedCountry[];
  consentVersion: string;
  /** LingoIsland's public sending number, for "text START to …". */
  lingoNumber: string | null;
  /** WhatsApp practice is configured on this deployment. */
  whatsapp: {
    available: boolean;
    /** Empty list means any country. */
    supportedCountries: string[];
  };
  contact: {
    status: SmsContactStatus;
    channel: "sms" | "whatsapp";
    maskedNumber: string;
    countryCode: string | null;
    verifiedAt: string | null;
    consentAt: string | null;
    welcomeSentAt: string | null;
    pausedAt: string | null;
    /** "user" (paused from settings or by text) or "no_response" (auto-paused). */
    pausedReason: "user" | "no_response" | null;
    optedOutAt: string | null;
    disabledAt: string | null;
    hasDeliveryIssue: boolean;
  } | null;
  pending: {
    maskedNumber: string;
    channel: "sms" | "whatsapp";
    expiresAt: string;
    expired: boolean;
    attemptsRemaining: number;
    sendsRemaining: number;
    resendAvailableAt: string;
    deliveryFailed: boolean;
  } | null;
};

export type SmsPhoneErrorCode =
  | "unauthorized"
  | "forbidden"
  | "bad_request"
  | "sms_unavailable"
  | "whatsapp_unavailable"
  | "consent_required"
  | "invalid_phone"
  | "unsupported_country"
  | "not_mobile"
  | "rate_limited"
  | "send_failed"
  | "no_pending"
  | "expired"
  | "too_many_attempts"
  | "invalid_code"
  | "incorrect_code"
  | "transfer_required"
  | "transfer_conflict"
  | "send_limit"
  | "cooldown"
  | "no_contact"
  | "text_start_required"
  | "reverify_required"
  | "server_error";

export type SmsPhoneErrorBody = {
  error: string;
  code: SmsPhoneErrorCode;
  retryAfterSeconds?: number;
  attemptsRemaining?: number;
  state?: SmsPhoneState;
};
