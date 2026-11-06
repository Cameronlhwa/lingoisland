import {
  cleanCodeInput,
  generateVerificationCode,
  hashVerificationCode,
  isWellFormedCode,
  verificationCodeMatches,
} from "./codes";
import { SMS_LIMITS, type SmsConfig } from "./config";
import { SMS_CONSENT_VERSION, isSmsConsentSource } from "./consent";
import { describeSmsError, logSmsError } from "./log";
import { sendHuahuaWelcome } from "./huahua/welcome";
import { verificationCodeMessage } from "./messages";
import {
  dialCodeForCountry,
  formatPhoneNumber,
  maskPhoneNumber,
  parsePhoneForSms,
  parsePhoneNumberFromString,
} from "./phone";
import type { SmsContactStatus, SmsPhoneErrorCode, SmsPhoneState } from "./phoneState";
import { consumeSmsRateLimits, type SmsLimitSpec } from "./rateLimit";
import type { SmsRpc } from "./rpc";
import type { SmsProvider } from "./types";

export type SmsPhoneDeps = {
  rpc: SmsRpc;
  provider: SmsProvider;
  config: SmsConfig;
  now?: () => Date;
};

export class SmsPhoneError extends Error {
  constructor(
    readonly code: SmsPhoneErrorCode,
    readonly status: number,
    message: string,
    readonly extra: { retryAfterSeconds?: number; attemptsRemaining?: number } = {},
  ) {
    super(message);
    this.name = "SmsPhoneError";
  }
}

type RawContact = {
  id: string;
  user_id: string;
  phone_number: string;
  status: SmsContactStatus;
  verified_at: string | null;
  consent_at: string | null;
  welcome_sent_at: string | null;
  paused_at: string | null;
  paused_reason?: "user" | "no_response" | null;
  opted_out_at: string | null;
  disabled_at: string | null;
  last_delivery_error: string | null;
  delivery_failure_count: number;
};

type RawPending = {
  id: string;
  phone_number: string;
  expires_at: string;
  attempt_count: number;
  send_count: number;
  last_sent_at: string;
  delivery_status: string | null;
};

type RawState = { contact: RawContact | null; pending: RawPending | null };

const FAILED_DELIVERY_STATUSES = new Set(["send_failed", "sending_failed", "delivery_failed"]);
const RECENT_VERIFICATION_MS = 15 * 60 * 1000;

function requireEnabled(config: SmsConfig) {
  if (!config.enabled) {
    throw new SmsPhoneError("sms_unavailable", 503, "Texting practice is temporarily unavailable.");
  }
}

function rateLimited(retryAfterSeconds: number) {
  return new SmsPhoneError(
    "rate_limited",
    429,
    "Too many attempts. Please wait a bit and try again.",
    { retryAfterSeconds },
  );
}

function sendLimits(userId: string, phone: string, ip: string | null): SmsLimitSpec[] {
  const limits: SmsLimitSpec[] = [
    { name: "send:user:hour", identifier: userId, ...SMS_LIMITS.sendPerUserHour },
    { name: "send:user:day", identifier: userId, ...SMS_LIMITS.sendPerUserDay },
    { name: "send:phone:hour", identifier: phone, ...SMS_LIMITS.sendPerPhoneHour },
    { name: "send:phone:day", identifier: phone, ...SMS_LIMITS.sendPerPhoneDay },
  ];
  if (ip) limits.push({ name: "send:ip:hour", identifier: ip, ...SMS_LIMITS.sendPerIpHour });
  return limits;
}

async function loadRawState(deps: SmsPhoneDeps, userId: string) {
  return deps.rpc<RawState>("sms_get_phone_state", { p_user_id: userId });
}

export function toPublicState(config: SmsConfig, raw: RawState, now = Date.now()): SmsPhoneState {
  const contact = raw.contact;
  const pending = raw.pending;
  const resendAt = pending
    ? new Date(new Date(pending.last_sent_at).getTime() + config.resendCooldownSeconds * 1000)
    : null;

  return {
    available: config.enabled,
    supportedCountries: config.supportedCountries
      .map((code) => ({ code, dialCode: dialCodeForCountry(code) }))
      .filter((country): country is { code: string; dialCode: string } => Boolean(country.dialCode)),
    consentVersion: SMS_CONSENT_VERSION,
    lingoNumber: config.fromNumber ? formatPhoneNumber(config.fromNumber) : null,
    contact: contact
      ? {
          status: contact.status,
          maskedNumber: maskPhoneNumber(contact.phone_number),
          countryCode: parsePhoneNumberFromString(contact.phone_number)?.country ?? null,
          verifiedAt: contact.verified_at,
          consentAt: contact.consent_at,
          welcomeSentAt: contact.welcome_sent_at,
          pausedAt: contact.paused_at,
          pausedReason: contact.paused_reason ?? null,
          optedOutAt: contact.opted_out_at,
          disabledAt: contact.disabled_at,
          hasDeliveryIssue: contact.status === "disabled" || (contact.delivery_failure_count ?? 0) > 0,
        }
      : null,
    pending: pending
      ? {
          maskedNumber: maskPhoneNumber(pending.phone_number),
          expiresAt: pending.expires_at,
          expired: new Date(pending.expires_at).getTime() <= now,
          attemptsRemaining: Math.max(config.maxVerifyAttempts - pending.attempt_count, 0),
          sendsRemaining: Math.max(config.maxSendsPerVerification - pending.send_count, 0),
          resendAvailableAt: (resendAt ?? new Date(now)).toISOString(),
          deliveryFailed: FAILED_DELIVERY_STATUSES.has(pending.delivery_status ?? ""),
        }
      : null,
  };
}

export async function getPhoneState(deps: SmsPhoneDeps, userId: string) {
  return toPublicState(deps.config, await loadRawState(deps, userId));
}

async function sendVerificationCode(
  deps: SmsPhoneDeps,
  verificationId: string,
  phoneNumber: string,
  code: string,
) {
  try {
    const sent = await deps.provider.send({
      to: phoneNumber,
      body: verificationCodeMessage(code, deps.config.codeTtlMinutes),
    });
    await deps.rpc("sms_record_verification_send", {
      p_verification_id: verificationId,
      p_provider_message_id: sent.id,
      p_delivery_status: sent.status || "queued",
      p_delivery_error: null,
    });
  } catch (error) {
    logSmsError("verification send failed", error, { phone: maskPhoneNumber(phoneNumber) });
    await deps.rpc("sms_record_verification_send", {
      p_verification_id: verificationId,
      p_provider_message_id: null,
      p_delivery_status: "send_failed",
      p_delivery_error: describeSmsError(error),
    });
    throw new SmsPhoneError(
      "send_failed",
      502,
      "We couldn't text that number. Check it and try again.",
    );
  }
}

export async function startVerification(
  deps: SmsPhoneDeps,
  input: {
    userId: string;
    ip: string | null;
    country: unknown;
    phoneNumber: unknown;
    consent: unknown;
    consentVersion: unknown;
    source: unknown;
  },
) {
  requireEnabled(deps.config);

  if (input.consent !== true || input.consentVersion !== SMS_CONSENT_VERSION) {
    throw new SmsPhoneError("consent_required", 400, "Please agree to receive texts first.");
  }
  if (!isSmsConsentSource(input.source)) {
    throw new SmsPhoneError("bad_request", 400, "Invalid request.");
  }

  const parsed = parsePhoneForSms(
    typeof input.phoneNumber === "string" ? input.phoneNumber : "",
    typeof input.country === "string" ? input.country : undefined,
    deps.config.supportedCountries,
  );
  if (!parsed.ok) {
    const messages = {
      invalid: "That doesn't look like a valid phone number.",
      unsupported_country: "Texting practice isn't available in that country yet.",
      not_mobile: "Please use a mobile number that can receive texts.",
    } as const;
    const code = parsed.reason === "invalid" ? "invalid_phone" : parsed.reason;
    throw new SmsPhoneError(code, 400, messages[parsed.reason]);
  }

  const limit = await consumeSmsRateLimits(
    deps.rpc,
    deps.config.secret,
    sendLimits(input.userId, parsed.e164, input.ip),
  );
  if (!limit.allowed) throw rateLimited(limit.retryAfterSeconds);

  const code = generateVerificationCode();
  const started = await deps.rpc<{ status: string; id?: string }>("sms_start_verification", {
    p_user_id: input.userId,
    p_phone_number: parsed.e164,
    p_code_hash: hashVerificationCode(deps.config.secret, {
      userId: input.userId,
      phoneNumber: parsed.e164,
      code,
    }),
    p_expires_at: new Date(Date.now() + deps.config.codeTtlMinutes * 60_000).toISOString(),
    p_consent_source: input.source,
    p_consent_version: SMS_CONSENT_VERSION,
  });

  if (started.status === "started" && started.id) {
    await sendVerificationCode(deps, started.id, parsed.e164, code);
  }

  return {
    state: await getPhoneState(deps, input.userId),
    alreadyActive: started.status === "already_active",
    country: parsed.country,
  };
}

export async function resendVerification(
  deps: SmsPhoneDeps,
  input: { userId: string; ip: string | null },
) {
  requireEnabled(deps.config);

  const raw = await loadRawState(deps, input.userId);
  const pending = raw.pending;
  if (!pending) {
    throw new SmsPhoneError("no_pending", 404, "Start again by entering your phone number.");
  }
  if (pending.send_count >= deps.config.maxSendsPerVerification) {
    throw new SmsPhoneError("send_limit", 429, "Too many codes sent. Start again with your number later.");
  }
  const waitMs =
    new Date(pending.last_sent_at).getTime() + deps.config.resendCooldownSeconds * 1000 - Date.now();
  if (waitMs > 0) {
    throw new SmsPhoneError("cooldown", 429, "Please wait a moment before requesting another code.", {
      retryAfterSeconds: Math.ceil(waitMs / 1000),
    });
  }

  const limit = await consumeSmsRateLimits(
    deps.rpc,
    deps.config.secret,
    sendLimits(input.userId, pending.phone_number, input.ip),
  );
  if (!limit.allowed) throw rateLimited(limit.retryAfterSeconds);

  const code = generateVerificationCode();
  const resent = await deps.rpc<{
    status: string;
    id?: string;
    phone_number?: string;
    retry_after_seconds?: number;
  }>("sms_resend_verification", {
    p_user_id: input.userId,
    p_code_hash: hashVerificationCode(deps.config.secret, {
      userId: input.userId,
      phoneNumber: pending.phone_number,
      code,
    }),
    p_expires_at: new Date(Date.now() + deps.config.codeTtlMinutes * 60_000).toISOString(),
    p_max_sends: deps.config.maxSendsPerVerification,
    p_cooldown_seconds: deps.config.resendCooldownSeconds,
  });

  if (resent.status === "no_pending") {
    throw new SmsPhoneError("no_pending", 404, "Start again by entering your phone number.");
  }
  if (resent.status === "send_limit") {
    throw new SmsPhoneError("send_limit", 429, "Too many codes sent. Start again with your number later.");
  }
  if (resent.status === "cooldown") {
    throw new SmsPhoneError("cooldown", 429, "Please wait a moment before requesting another code.", {
      retryAfterSeconds: resent.retry_after_seconds,
    });
  }
  if (!resent.id || resent.phone_number !== pending.phone_number) {
    throw new SmsPhoneError("no_pending", 404, "Start again by entering your phone number.");
  }

  await sendVerificationCode(deps, resent.id, pending.phone_number, code);
  return { state: await getPhoneState(deps, input.userId) };
}

export async function verifyPhoneCode(
  deps: SmsPhoneDeps,
  input: {
    userId: string;
    code: unknown;
    confirmTransfer: unknown;
    displayName?: string | null;
    languageLevel?: string | null;
  },
) {
  requireEnabled(deps.config);

  const code = cleanCodeInput(input.code);
  if (!isWellFormedCode(code)) {
    throw new SmsPhoneError("invalid_code", 400, "Enter the 6-digit code we texted you.");
  }

  const limit = await consumeSmsRateLimits(deps.rpc, deps.config.secret, [
    { name: "verify:user:hour", identifier: input.userId, ...SMS_LIMITS.verifyPerUserHour },
  ]);
  if (!limit.allowed) throw rateLimited(limit.retryAfterSeconds);

  const attempt = await deps.rpc<{
    status: string;
    id?: string;
    phone_number?: string;
    code_hash?: string;
    attempts_remaining?: number;
  }>("sms_begin_verification_attempt", {
    p_user_id: input.userId,
    p_max_attempts: deps.config.maxVerifyAttempts,
  });

  if (attempt.status === "no_pending") {
    // A repeated submit after success (double tap, retry) is not an error.
    const raw = await loadRawState(deps, input.userId);
    const verifiedAt = raw.contact?.verified_at ? new Date(raw.contact.verified_at).getTime() : 0;
    if (raw.contact?.status === "active" && Date.now() - verifiedAt < RECENT_VERIFICATION_MS) {
      return { state: toPublicState(deps.config, raw), replaced: false, transferred: false, alreadyVerified: true };
    }
    throw new SmsPhoneError("no_pending", 404, "Start again by entering your phone number.");
  }
  if (attempt.status === "expired") {
    throw new SmsPhoneError("expired", 410, "That code expired. Request a new one.");
  }
  if (attempt.status === "too_many_attempts") {
    throw new SmsPhoneError("too_many_attempts", 429, "Too many incorrect codes. Request a new one.");
  }
  if (!attempt.id || !attempt.phone_number || !attempt.code_hash) {
    throw new SmsPhoneError("server_error", 500, "Something went wrong. Please try again.");
  }

  const matches = verificationCodeMatches(deps.config.secret, attempt.code_hash, {
    userId: input.userId,
    phoneNumber: attempt.phone_number,
    code,
  });
  if (!matches) {
    const attemptsRemaining = attempt.attempts_remaining ?? 0;
    throw new SmsPhoneError(
      attemptsRemaining > 0 ? "incorrect_code" : "too_many_attempts",
      attemptsRemaining > 0 ? 400 : 429,
      attemptsRemaining > 0
        ? "That code isn't right. Check the text and try again."
        : "Too many incorrect codes. Request a new one.",
      { attemptsRemaining },
    );
  }

  const before = await loadRawState(deps, input.userId);
  if (before.contact && before.contact.phone_number !== attempt.phone_number) {
    const replaceLimit = await consumeSmsRateLimits(deps.rpc, deps.config.secret, [
      { name: "replace:user:day", identifier: input.userId, ...SMS_LIMITS.replacePerUserDay },
    ]);
    if (!replaceLimit.allowed) throw rateLimited(replaceLimit.retryAfterSeconds);
  }

  const completed = await deps.rpc<{
    status: string;
    contact?: RawContact | null;
    needs_welcome?: boolean;
    replaced?: boolean;
    transferred?: boolean;
  }>("sms_complete_verification", {
    p_user_id: input.userId,
    p_verification_id: attempt.id,
    p_confirm_transfer: input.confirmTransfer === true,
    p_display_name: (input.displayName || "").slice(0, 60),
    p_language_level: (input.languageLevel || "").slice(0, 20),
  });

  if (completed.status === "transfer_required") {
    throw new SmsPhoneError(
      "transfer_required",
      409,
      "This number is connected to another LingoIsland account. Move it to this account?",
    );
  }
  if (completed.status === "conflict") {
    throw new SmsPhoneError(
      "transfer_conflict",
      409,
      "That number was just connected somewhere else. Request a new code and try again.",
    );
  }
  if (completed.status === "expired") {
    throw new SmsPhoneError("expired", 410, "That code expired. Request a new one.");
  }
  if (completed.status !== "verified" && completed.status !== "already_verified") {
    throw new SmsPhoneError("no_pending", 404, "Start again by entering your phone number.");
  }

  if (completed.needs_welcome && completed.contact?.id) {
    await sendWelcome(deps, input.userId, completed.contact.id);
  }

  return {
    state: await getPhoneState(deps, input.userId),
    replaced: Boolean(completed.replaced),
    transferred: Boolean(completed.transferred),
    alreadyVerified: completed.status === "already_verified",
  };
}

export async function sendWelcome(deps: SmsPhoneDeps, userId: string, contactId: string) {
  try {
    const limit = await consumeSmsRateLimits(deps.rpc, deps.config.secret, [
      { name: "welcome:user:day", identifier: userId, ...SMS_LIMITS.welcomePerUserDay },
    ]);
    if (!limit.allowed) return { status: "skipped" as const, reason: "rate_limited" };
    return await sendHuahuaWelcome(deps, userId, contactId);
  } catch (error) {
    // Verification already succeeded; a missing welcome must not undo it.
    logSmsError("welcome send failed", error);
    return { status: "failed" as const, reason: describeSmsError(error) };
  }
}

export async function setTextingPaused(deps: SmsPhoneDeps, userId: string, paused: boolean) {
  const result = await deps.rpc<{ status: string; contact?: RawContact }>("sms_set_paused", {
    p_user_id: userId,
    p_paused: paused,
  });

  if (result.status === "no_contact") {
    throw new SmsPhoneError("no_contact", 404, "No phone number is connected.");
  }
  if (result.status === "invalid_state") {
    const status = result.contact?.status;
    if (status === "opted_out") {
      throw new SmsPhoneError(
        "text_start_required",
        409,
        "You replied STOP. Text START to LingoIsland to turn texts back on.",
      );
    }
    throw new SmsPhoneError("reverify_required", 409, "Please verify your number again.");
  }
  return { state: await getPhoneState(deps, userId) };
}

export async function disconnectPhone(deps: SmsPhoneDeps, userId: string) {
  await deps.rpc("sms_disconnect", { p_user_id: userId });
  return { state: await getPhoneState(deps, userId) };
}
