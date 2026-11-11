import { verificationCodeMatches } from "./codes";
import { SMS_LIMITS, type SmsConfig } from "./config";
import type { TurnGenerator } from "./huahua/ai";
import { respondToInbound } from "./huahua/conversation";
import { detectSmsKeyword } from "./keywords";
import { describeSmsError, logSmsError } from "./log";
import { SMS_HELP_MESSAGE, SMS_RESUBSCRIBED_MESSAGE } from "./messages";
import { sendTrackedSms } from "./outbound";
import { maskPhoneNumber, normalizePhoneNumber } from "./phone";
import { consumeSmsRateLimits } from "./rateLimit";
import type { SmsRpc } from "./rpc";
import type { SmsProvider, SmsWebhookEvent } from "./types";

/**
 * Processes stored, signature-verified webhook events. Runs after the
 * webhook has been acknowledged (via waitUntil) and from the retry cron, so
 * every step is idempotent. This module has no request/response coupling and
 * can move to a dedicated worker unchanged.
 */

export type SmsProcessorDeps = {
  rpc: SmsRpc;
  provider: SmsProvider;
  config: SmsConfig;
  generateTurn: TurnGenerator;
  /** Injected clock (tests). */
  now?: () => Date;
  turnTimeoutMs?: number;
};

export const WEBHOOK_LEASE_SECONDS = 90;
export const WEBHOOK_MAX_ATTEMPTS = 5;
const FAILED_STATUSES = new Set(["delivery_failed", "sending_failed"]);

type InboundResult = {
  outcome: string;
  message_id?: string;
  contact_id?: string;
  duplicate?: boolean;
  contact?: {
    id: string;
    user_id: string;
    status: string;
    display_name: string | null;
  };
};

export async function processSmsWebhookEvent(deps: SmsProcessorDeps, eventRowId: string) {
  const claim = await deps.rpc<{ claimed: boolean; attempt_count?: number; payload?: unknown }>(
    "sms_claim_webhook_event",
    {
      p_event_row_id: eventRowId,
      p_lease_seconds: WEBHOOK_LEASE_SECONDS,
      p_max_attempts: WEBHOOK_MAX_ATTEMPTS,
    },
  );
  if (!claim?.claimed) return { outcome: "not_claimed" };

  try {
    const event = deps.provider.parseStoredEvent(claim.payload);
    const outcome = await handleEvent(deps, event);
    await deps.rpc("sms_finish_webhook_event", {
      p_event_row_id: eventRowId,
      p_outcome: outcome,
      p_error: null,
      p_retry_after_seconds: null,
      p_max_attempts: WEBHOOK_MAX_ATTEMPTS,
    });
    return { outcome };
  } catch (error) {
    logSmsError("webhook event processing failed", error, { eventRowId });
    const attempt = claim.attempt_count ?? 1;
    await deps.rpc("sms_finish_webhook_event", {
      p_event_row_id: eventRowId,
      p_outcome: "error",
      p_error: describeSmsError(error),
      p_retry_after_seconds: Math.min(30 * 2 ** (attempt - 1), 3600),
      p_max_attempts: WEBHOOK_MAX_ATTEMPTS,
    });
    return { outcome: "error" };
  }
}

async function handleEvent(deps: SmsProcessorDeps, event: SmsWebhookEvent): Promise<string> {
  switch (event.type) {
    case "message.sent":
    case "message.finalized":
      return handleDeliveryStatus(deps, event);
    case "message.received":
      return handleInbound(deps, event);
    default:
      return "ignored_event_type";
  }
}

async function handleDeliveryStatus(deps: SmsProcessorDeps, event: SmsWebhookEvent) {
  const message = event.message;
  if (!message) return "ignored_no_message";

  const status = message.status || (event.type === "message.sent" ? "sent" : "unknown");
  const failed = FAILED_STATUSES.has(status);
  const errorText = message.errors
    ?.map((error) => [error.code, error.title].filter(Boolean).join(" "))
    .join("; ");

  const result = await deps.rpc<{ outcome: string }>("sms_apply_delivery_status", {
    p_provider: deps.provider.name,
    p_provider_message_id: message.id,
    p_status: status,
    p_error: failed ? errorText || status : null,
    p_failed: failed,
    p_recipient_opted_out: failed && deps.provider.isOptOutError(message.errors),
    p_disable_after_failures: deps.config.disableAfterFailures,
  });
  return result?.outcome ?? "status_updated";
}

async function handleInbound(deps: SmsProcessorDeps, event: SmsWebhookEvent) {
  const message = event.message;
  if (!message) return "ignored_no_message";
  if (message.direction !== "inbound") return "ignored_outbound";

  let from: string;
  let to: string;
  try {
    from = normalizePhoneNumber(message.from);
    to = normalizePhoneNumber(message.to);
  } catch {
    return "ignored_invalid_number";
  }

  if (deps.config.ownNumbers.has(from)) return "ignored_own_number";
  if (deps.config.ownNumbers.size > 0 && !deps.config.ownNumbers.has(to)) {
    return "ignored_other_number";
  }

  if (message.channel === "whatsapp") {
    const connected = await completeWhatsAppReplyConnect(deps, from, message.body, event.occurredAt);
    if (connected) return connected;
  }

  const keyword = detectSmsKeyword(message.body);
  const result = await deps.rpc<InboundResult>("sms_handle_inbound", {
    p_provider: deps.provider.name,
    p_provider_message_id: message.id,
    p_from: from,
    p_body: message.body,
    p_occurred_at: event.occurredAt,
    p_keyword: keyword,
    p_raw_payload: event.raw ?? null,
    p_channel: message.channel ?? "sms",
  });

  switch (result.outcome) {
    case "unknown_number":
      if (keyword === "help") return sendHelpToUnknown(deps, from, to, message.channel ?? "sms");
      return "ignored_unknown_number";
    case "help":
      return sendFixed(deps, result, from, "help", SMS_HELP_MESSAGE, false);
    case "resubscribed":
      return sendFixed(deps, result, from, "resubscribed", SMS_RESUBSCRIBED_MESSAGE, true);
    case "reply":
      if (!result.contact?.id || !result.message_id) return "reply_missing_contact";
      return respondToInbound(deps, {
        contact: result.contact,
        inboundId: result.message_id,
        body: message.body,
        ownNumber: to,
      });
    default:
      return result.outcome;
  }
}

/** A learner sends this one-time code from WhatsApp to prove they control the entered number. */
async function completeWhatsAppReplyConnect(deps: SmsProcessorDeps, phoneNumber: string, body: string, occurredAt: string) {
  const match = body.match(/\bLI(?:NGO)?[-\s]?CONNECT[-\s]?(\d{6})\b/i) ?? body.match(/\bLI[-\s]?(\d{6})\b/i);
  if (!match) return null;

  const pending = await deps.rpc<{
    id?: string;
    user_id?: string;
    phone_number?: string;
    code_hash?: string;
  } | null>("sms_get_whatsapp_connect_candidate", { p_phone_number: phoneNumber });
  if (!pending?.id || !pending.user_id || !pending.phone_number || !pending.code_hash) return "whatsapp_connect_not_pending";
  if (!verificationCodeMatches(deps.config.secret, pending.code_hash, {
    userId: pending.user_id,
    phoneNumber: pending.phone_number,
    code: match[1],
  })) {
    return "whatsapp_connect_invalid_code";
  }

  const completed = await deps.rpc<{ status?: string }>("sms_complete_verification", {
    p_user_id: pending.user_id,
    p_verification_id: pending.id,
    p_confirm_transfer: false,
    p_display_name: "",
    p_language_level: "",
  });
  if (completed?.status === "verified" || completed?.status === "already_verified") {
    await deps.rpc("sms_mark_whatsapp_connect_inbound", {
      p_user_id: pending.user_id,
      p_phone_number: pending.phone_number,
      p_occurred_at: occurredAt,
    });
    return "whatsapp_connected";
  }
  return `whatsapp_connect_${completed?.status ?? "failed"}`;
}

async function sendHelpToUnknown(deps: SmsProcessorDeps, from: string, to: string, channel: "sms" | "whatsapp") {
  const limit = await consumeSmsRateLimits(deps.rpc, deps.config.secret, [
    { name: "help:phone:day", identifier: from, ...SMS_LIMITS.helpPerPhoneDay },
  ]);
  if (!limit.allowed) return "help_rate_limited";
  try {
    // The sender just messaged us, so a WhatsApp reply is inside the 24-hour window.
    await deps.provider.send(
      channel === "whatsapp"
        ? { to: from, body: SMS_HELP_MESSAGE, channel: "whatsapp" }
        : { to: from, from: to, body: SMS_HELP_MESSAGE },
    );
    return "help_sent_unknown";
  } catch (error) {
    logSmsError("help reply failed", error, { phone: maskPhoneNumber(from) });
    return "help_failed";
  }
}

async function sendFixed(
  deps: SmsProcessorDeps,
  result: InboundResult,
  from: string,
  kind: "help" | "resubscribed",
  body: string,
  requireActive: boolean,
) {
  if (!result.contact_id || !result.message_id) return `${kind}_missing_contact`;
  if (kind === "help") {
    const limit = await consumeSmsRateLimits(deps.rpc, deps.config.secret, [
      { name: "help:phone:day", identifier: from, ...SMS_LIMITS.helpPerPhoneDay },
    ]);
    if (!limit.allowed) return "help_rate_limited";
  }
  const sent = await sendTrackedSms(deps, {
    contactId: result.contact_id,
    idempotencyKey: `${kind}:${result.message_id}`,
    kind,
    requireActive,
    body,
  });
  return sent.status === "sent" ? `${kind}_sent` : `${kind}_${sent.status}`;
}
