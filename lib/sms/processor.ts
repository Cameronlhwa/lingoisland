import { SMS_LIMITS, type SmsConfig } from "./config";
import type { generateSmsReply } from "./generate-reply";
import { detectSmsKeyword } from "./keywords";
import { describeSmsError, logSmsError } from "./log";
import { SMS_FALLBACK_REPLY, SMS_HELP_MESSAGE, SMS_RESUBSCRIBED_MESSAGE } from "./messages";
import { sendTrackedSms } from "./outbound";
import { isE164, maskPhoneNumber, normalizePhoneNumber } from "./phone";
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
  generateReply: typeof generateSmsReply;
};

export const WEBHOOK_LEASE_SECONDS = 90;
export const WEBHOOK_MAX_ATTEMPTS = 5;
const HISTORY_LIMIT = 12;
const FAILED_STATUSES = new Set(["delivery_failed", "sending_failed"]);

type InboundResult = {
  outcome: string;
  message_id?: string;
  contact_id?: string;
  duplicate?: boolean;
  contact?: {
    id: string;
    display_name: string;
    language_level: string;
    persona: string;
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

  const keyword = detectSmsKeyword(message.body);
  const result = await deps.rpc<InboundResult>("sms_handle_inbound", {
    p_provider: deps.provider.name,
    p_provider_message_id: message.id,
    p_from: from,
    p_body: message.body,
    p_occurred_at: event.occurredAt,
    p_keyword: keyword,
    p_raw_payload: event.raw ?? null,
  });

  switch (result.outcome) {
    case "unknown_number":
      if (keyword === "help") return sendHelpToUnknown(deps, from, to);
      return "ignored_unknown_number";
    case "help":
      return sendFixed(deps, result, from, "help", SMS_HELP_MESSAGE, false);
    case "resubscribed":
      return sendFixed(deps, result, from, "resubscribed", SMS_RESUBSCRIBED_MESSAGE, true);
    case "reply":
      return replyToInbound(deps, result, to);
    default:
      return result.outcome;
  }
}

async function sendHelpToUnknown(deps: SmsProcessorDeps, from: string, to: string) {
  const limit = await consumeSmsRateLimits(deps.rpc, deps.config.secret, [
    { name: "help:phone:day", identifier: from, ...SMS_LIMITS.helpPerPhoneDay },
  ]);
  if (!limit.allowed) return "help_rate_limited";
  try {
    await deps.provider.send({ to: from, from: to, body: SMS_HELP_MESSAGE });
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

async function generateWithRetry(
  deps: SmsProcessorDeps,
  input: Parameters<SmsProcessorDeps["generateReply"]>[0],
) {
  try {
    return await deps.generateReply(input);
  } catch (firstError) {
    logSmsError("AI reply attempt failed, retrying", firstError);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return deps.generateReply(input);
  }
}

async function replyToInbound(deps: SmsProcessorDeps, result: InboundResult, ownNumber: string) {
  const contact = result.contact;
  const inboundId = result.message_id;
  if (!contact?.id || !inboundId) return "reply_missing_contact";

  const limit = await consumeSmsRateLimits(deps.rpc, deps.config.secret, [
    { name: "ai:contact:hour", identifier: contact.id, ...SMS_LIMITS.aiRepliesPerContactHour },
    { name: "ai:contact:day", identifier: contact.id, ...SMS_LIMITS.aiRepliesPerContactDay },
  ]);
  if (!limit.allowed) return "ai_rate_limited";

  const sent = await sendTrackedSms(deps, {
    contactId: contact.id,
    idempotencyKey: `reply:${inboundId}`,
    kind: "reply",
    requireActive: true,
    from: isE164(ownNumber) ? ownNumber : undefined,
    body: async () => {
      const history = await deps.rpc<Array<{ direction: "inbound" | "outbound"; body: string }>>(
        "sms_get_conversation",
        { p_contact_id: contact.id, p_until_message_id: inboundId, p_limit: HISTORY_LIMIT },
      );
      try {
        return await generateWithRetry(deps, {
          learnerName: contact.display_name || "Learner",
          level: contact.language_level || "beginner",
          persona: contact.persona === "Huahua" ? "华华 (Huahua)" : contact.persona || "华华 (Huahua)",
          history: history ?? [],
        });
      } catch (error) {
        logSmsError("AI reply failed", error, { contactId: contact.id });
        // One short apology per hour; beyond that stay quiet rather than spam.
        const fallback = await consumeSmsRateLimits(deps.rpc, deps.config.secret, [
          { name: "fallback:contact:hour", identifier: contact.id, ...SMS_LIMITS.fallbackPerContactHour },
        ]);
        if (!fallback.allowed) throw error;
        return SMS_FALLBACK_REPLY;
      }
    },
  });

  if (sent.status === "sent") return "replied";
  if (sent.status === "skipped") return `reply_skipped_${sent.reason}`;
  return "reply_failed";
}
