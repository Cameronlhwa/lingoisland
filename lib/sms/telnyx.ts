import { createPublicKey, verify } from "node:crypto";
import {
  SmsSendError,
  type SendSmsInput,
  type SendSmsResult,
  type SmsDeliveryError,
  type SmsProvider,
  type SmsWebhookEvent,
} from "./types";

const TELNYX_API_URL = "https://api.telnyx.com/v2/messages";
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
const SEND_TIMEOUT_MS = 10_000;
// Telnyx: "Blocked due to STOP message" (recipient opted out at the carrier/provider).
const OPT_OUT_ERROR_CODES = new Set(["40300"]);

type TelnyxEnvelope = {
  data?: {
    event_type?: string;
    id?: string;
    occurred_at?: string;
    payload?: {
      id?: string;
      direction?: string;
      from?: { phone_number?: string };
      to?: Array<{ phone_number?: string; status?: string }>;
      text?: string;
      errors?: Array<{ code?: string | number; title?: string }>;
    };
  };
};

type TelnyxErrorBody = { errors?: Array<{ code?: string | number; title?: string }> };

export function verifyTelnyxSignature(rawBody: string, signature: string, timestamp: string) {
  const publicKeyBase64 = process.env.TELNYX_PUBLIC_KEY?.trim();
  if (!publicKeyBase64) {
    throw new Error("TELNYX_PUBLIC_KEY is not configured");
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }

  const rawPublicKey = Buffer.from(publicKeyBase64, "base64");
  if (rawPublicKey.length !== 32) return false;

  const publicKey = createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, rawPublicKey]),
    format: "der",
    type: "spki",
  });

  try {
    return verify(
      null,
      Buffer.from(`${timestamp}|${rawBody}`),
      publicKey,
      Buffer.from(signature, "base64")
    );
  } catch {
    return false;
  }
}

function toDeliveryErrors(
  errors: Array<{ code?: string | number; title?: string }> | undefined,
): SmsDeliveryError[] | undefined {
  if (!Array.isArray(errors) || errors.length === 0) return undefined;
  return errors.map((error) => ({
    code: error.code != null ? String(error.code) : undefined,
    title: typeof error.title === "string" ? error.title : undefined,
  }));
}

export class TelnyxSmsProvider implements SmsProvider {
  readonly name = "telnyx";

  async send(input: SendSmsInput): Promise<SendSmsResult> {
    const apiKey = process.env.TELNYX_API_KEY?.trim();
    const from = input.from || process.env.TELNYX_FROM_NUMBER?.trim();
    if (!apiKey) throw new SmsSendError("TELNYX_API_KEY is not configured", { notSent: true });
    if (!from) throw new SmsSendError("TELNYX_FROM_NUMBER is not configured", { notSent: true });

    let response: Response;
    try {
      response = await fetch(TELNYX_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: input.to, text: input.body }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
    } catch (error) {
      // The request may have reached Telnyx, so it is not safe to resend.
      throw new SmsSendError(
        `Telnyx send request failed: ${error instanceof Error ? error.name : "unknown"}`,
        { notSent: false },
      );
    }

    const raw = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const errors = toDeliveryErrors((raw as TelnyxErrorBody | null)?.errors);
      const code = errors?.[0]?.code;
      const definitelyRejected =
        (response.status >= 400 && response.status < 500 && response.status !== 408) ||
        response.status === 503;
      throw new SmsSendError(
        `Telnyx send failed (${response.status}${code ? `, code ${code}` : ""}): ${errors?.[0]?.title ?? "unknown error"}`,
        {
          notSent: definitelyRejected,
          retryable: response.status === 429 || response.status === 503,
          code,
          recipientOptedOut: this.isOptOutError(errors),
        },
      );
    }

    const data = (raw as { data?: { id?: string; to?: Array<{ status?: string }> } } | null)?.data;
    if (!data?.id) {
      throw new SmsSendError("Telnyx response did not include a message id", { notSent: false });
    }
    return { id: data.id, status: data.to?.[0]?.status || "queued", raw };
  }

  async parseWebhook(request: Request, rawBody: string): Promise<SmsWebhookEvent> {
    const signature = request.headers.get("telnyx-signature-ed25519") || "";
    const timestamp = request.headers.get("telnyx-timestamp") || "";
    const allowUnsigned =
      process.env.NODE_ENV !== "production" &&
      process.env.SMS_WEBHOOK_ALLOW_UNSIGNED === "true";

    if (!allowUnsigned && !verifyTelnyxSignature(rawBody, signature, timestamp)) {
      throw new Error("Invalid Telnyx webhook signature");
    }

    return this.parseStoredEvent(JSON.parse(rawBody));
  }

  parseStoredEvent(payload: unknown): SmsWebhookEvent {
    const envelope = payload as TelnyxEnvelope;
    const data = envelope?.data;
    const message = data?.payload;
    const eventType = data?.event_type;
    const type =
      eventType === "message.received" ||
      eventType === "message.sent" ||
      eventType === "message.finalized"
        ? eventType
        : "unknown";

    if (!data?.id) throw new Error("Telnyx webhook is missing an event id");

    const from = message?.from?.phone_number;
    const to = message?.to?.[0]?.phone_number;

    return {
      id: data.id,
      type,
      occurredAt: data.occurred_at || new Date().toISOString(),
      message:
        message?.id && from && to
          ? {
              id: message.id,
              direction: message.direction === "inbound" ? "inbound" : "outbound",
              from,
              to,
              body: message.text || "",
              status: message.to?.[0]?.status,
              errors: toDeliveryErrors(message.errors),
            }
          : undefined,
      raw: envelope,
    };
  }

  isOptOutError(errors: SmsDeliveryError[] | undefined) {
    return Boolean(errors?.some((error) => error.code && OPT_OUT_ERROR_CODES.has(error.code)));
  }
}
