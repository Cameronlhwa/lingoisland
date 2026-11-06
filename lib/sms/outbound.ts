import { describeSmsError } from "./log";
import type { SmsRpc } from "./rpc";
import { estimateSmsSegments } from "./segments";
import { SmsSendError, type SmsProvider } from "./types";

export type OutboundKind =
  | "reply"
  | "fallback"
  | "welcome"
  | "help"
  | "resubscribed"
  | "manual"
  | "opener"
  | "control"
  | "command"
  | "notice"
  | "safety"
  | "persona";

export type MeterSpec = {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
  planKey: string;
  allowance: number;
};

export type UsageCharge = { usedBefore: number; used: number; allowance: number };

export type PreparedBody = {
  body: string;
  /** Skip metering for this text even though the send was metered (e.g. a crisis reply). */
  exempt?: boolean;
};

export type TrackedSendResult =
  | { status: "sent"; messageId: string; providerMessageId: string; body: string; segments: number; usage: UsageCharge | null }
  | { status: "skipped"; reason: string }
  | { status: "blocked"; messageId: string; reason: "allowance_exhausted"; usage: UsageCharge }
  | { status: "failed"; messageId: string; error: string };

const STALE_PREPARING_SECONDS = 120;

type ClaimResult = {
  claimed: boolean;
  reason?: string;
  message_id?: string;
  phone_number?: string;
  contact?: Record<string, unknown>;
};

type ChargeResult = {
  allowed: boolean;
  reason?: string;
  already_charged?: boolean;
  used_before?: number;
  used?: number;
  allowance?: number;
};

/**
 * Sends a text to a contact at most once per idempotency key. The row is
 * reserved before any slow work (e.g. AI generation) so concurrent or
 * retried processing cannot double-send. With `meter`, the text's segments
 * are charged to the learner's allowance atomically before sending; once
 * the allowance is used up the text is not sent ("blocked").
 */
export async function sendTrackedSms(
  deps: { rpc: SmsRpc; provider: SmsProvider },
  input: {
    contactId: string;
    idempotencyKey: string;
    kind: OutboundKind;
    /** Only send while the contact can receive this kind of text. */
    requireActive: boolean;
    body: string | ((contact: Record<string, unknown>) => Promise<string | PreparedBody>);
    from?: string;
    meter?: MeterSpec;
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
  let exempt = false;
  try {
    const prepared = typeof input.body === "string" ? input.body : await input.body(claim.contact ?? {});
    body = typeof prepared === "string" ? prepared : prepared.body;
    exempt = typeof prepared === "string" ? false : Boolean(prepared.exempt);
  } catch (error) {
    // Nothing reached the provider, so a later retry may reclaim this row.
    await completeOutbound(deps.rpc, messageId, {
      status: "failed",
      error: describeSmsError(error),
      retryable: true,
    });
    return { status: "failed", messageId, error: describeSmsError(error) };
  }

  const segments = estimateSmsSegments(body).segments;
  let usage: UsageCharge | null = null;
  if (input.meter && !exempt) {
    const charge = await deps.rpc<ChargeResult>("sms_usage_charge", {
      p_user_id: input.meter.userId,
      p_message_id: messageId,
      p_period_start: input.meter.periodStart.toISOString(),
      p_period_end: input.meter.periodEnd.toISOString(),
      p_plan_key: input.meter.planKey,
      p_allowance: input.meter.allowance,
      p_segments: segments,
      p_enforce: true,
    });
    usage = {
      usedBefore: charge.used_before ?? charge.used ?? 0,
      used: charge.used ?? 0,
      allowance: charge.allowance ?? input.meter.allowance,
    };
    if (!charge.allowed) {
      await completeOutbound(deps.rpc, messageId, { status: "blocked", error: "allowance_exhausted" });
      return { status: "blocked", messageId, reason: "allowance_exhausted", usage };
    }
  }

  try {
    const sent = await sendWithRetry(deps.provider, { to: claim.phone_number, body, from: input.from });
    await completeOutbound(deps.rpc, messageId, {
      body,
      providerMessageId: sent.id,
      status: sent.status || "queued",
    });
    return { status: "sent", messageId, providerMessageId: sent.id, body, segments, usage };
  } catch (error) {
    const sendError = error instanceof SmsSendError ? error : null;
    const notSent = Boolean(sendError?.notSent);
    if (usage && notSent) {
      await deps.rpc("sms_usage_refund", { p_message_id: messageId });
    }
    await completeOutbound(deps.rpc, messageId, {
      body,
      status: "failed",
      error: describeSmsError(error),
      // Only definite provider rejections are safe to send again.
      retryable: Boolean(notSent && sendError?.retryable),
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
