import { describeSmsError } from "./log";
import type { SmsRpc } from "./rpc";
import { SmsSendError, type SmsProvider } from "./types";

export type OutboundKind = "reply" | "fallback" | "welcome" | "help" | "resubscribed" | "manual";

export type TrackedSendResult =
  | { status: "sent"; messageId: string; providerMessageId: string }
  | { status: "skipped"; reason: string }
  | { status: "failed"; messageId: string; error: string };

const STALE_PREPARING_SECONDS = 120;

type ClaimResult = {
  claimed: boolean;
  reason?: string;
  message_id?: string;
  phone_number?: string;
  contact?: Record<string, unknown>;
};

/**
 * Sends a text to a contact at most once per idempotency key. The row is
 * reserved before any slow work (e.g. AI generation) so concurrent or
 * retried processing cannot double-send.
 */
export async function sendTrackedSms(
  deps: { rpc: SmsRpc; provider: SmsProvider },
  input: {
    contactId: string;
    idempotencyKey: string;
    kind: OutboundKind;
    /** Only send while the contact is active (AI replies, welcome). */
    requireActive: boolean;
    body: string | ((contact: Record<string, unknown>) => Promise<string>);
    from?: string;
  },
): Promise<TrackedSendResult> {
  const claim = await deps.rpc<ClaimResult>("sms_claim_outbound", {
    p_contact_id: input.contactId,
    p_idempotency_key: input.idempotencyKey,
    p_kind: input.kind,
    p_provider: deps.provider.name,
    p_require_active: input.requireActive,
    p_stale_seconds: STALE_PREPARING_SECONDS,
  });

  if (!claim?.claimed || !claim.message_id || !claim.phone_number) {
    return { status: "skipped", reason: claim?.reason ?? "not_claimed" };
  }
  const messageId = claim.message_id;

  let body: string;
  try {
    body = typeof input.body === "string" ? input.body : await input.body(claim.contact ?? {});
  } catch (error) {
    // Nothing reached the provider, so a later retry may reclaim this row.
    await completeOutbound(deps.rpc, messageId, {
      status: "failed",
      error: describeSmsError(error),
      retryable: true,
    });
    return { status: "failed", messageId, error: describeSmsError(error) };
  }

  try {
    const sent = await sendWithRetry(deps.provider, { to: claim.phone_number, body, from: input.from });
    await completeOutbound(deps.rpc, messageId, {
      body,
      providerMessageId: sent.id,
      status: sent.status || "queued",
    });
    return { status: "sent", messageId, providerMessageId: sent.id };
  } catch (error) {
    const sendError = error instanceof SmsSendError ? error : null;
    await completeOutbound(deps.rpc, messageId, {
      body,
      status: "failed",
      error: describeSmsError(error),
      // Only definite provider rejections are safe to send again.
      retryable: Boolean(sendError?.notSent && sendError.retryable),
      recipientOptedOut: Boolean(sendError?.recipientOptedOut),
    });
    return { status: "failed", messageId, error: describeSmsError(error) };
  }
}

async function sendWithRetry(
  provider: SmsProvider,
  input: { to: string; body: string; from?: string },
) {
  try {
    return await provider.send(input);
  } catch (error) {
    if (error instanceof SmsSendError && error.notSent && error.retryable) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return provider.send(input);
    }
    throw error;
  }
}

async function completeOutbound(
  rpc: SmsRpc,
  messageId: string,
  result: {
    body?: string;
    providerMessageId?: string;
    status: string;
    error?: string;
    retryable?: boolean;
    recipientOptedOut?: boolean;
  },
) {
  await rpc("sms_complete_outbound", {
    p_message_id: messageId,
    p_body: result.body ?? null,
    p_provider_message_id: result.providerMessageId ?? null,
    p_status: result.status,
    p_error: result.error ?? null,
    p_retryable: result.retryable ?? false,
    p_recipient_opted_out: result.recipientOptedOut ?? false,
  });
}
