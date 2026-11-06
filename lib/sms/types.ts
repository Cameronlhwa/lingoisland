export type SmsDirection = "inbound" | "outbound";

export type SendSmsInput = {
  to: string;
  body: string;
  from?: string;
};

export type SendSmsResult = {
  id: string;
  status: string;
  raw: unknown;
};

export type SmsDeliveryError = {
  code?: string;
  title?: string;
};

export type SmsWebhookMessage = {
  id: string;
  direction: SmsDirection;
  from: string;
  to: string;
  body: string;
  status?: string;
  errors?: SmsDeliveryError[];
};

export type SmsWebhookEvent = {
  id: string;
  type: "message.received" | "message.sent" | "message.finalized" | "unknown";
  occurredAt: string;
  message?: SmsWebhookMessage;
  raw: unknown;
};

/**
 * Thrown by providers when a send fails. `notSent` is true only when the
 * provider definitely rejected the message, which makes a retry safe.
 */
export class SmsSendError extends Error {
  readonly notSent: boolean;
  readonly retryable: boolean;
  readonly code?: string;
  readonly recipientOptedOut: boolean;

  constructor(
    message: string,
    opts: { notSent: boolean; retryable?: boolean; code?: string; recipientOptedOut?: boolean },
  ) {
    super(message);
    this.name = "SmsSendError";
    this.notSent = opts.notSent;
    this.retryable = Boolean(opts.retryable);
    this.code = opts.code;
    this.recipientOptedOut = Boolean(opts.recipientOptedOut);
  }
}

export interface SmsProvider {
  readonly name: string;
  send(input: SendSmsInput): Promise<SendSmsResult>;
  /** Verifies the request signature and parses the event. */
  parseWebhook(request: Request, rawBody: string): Promise<SmsWebhookEvent>;
  /** Parses a payload that was already verified and stored. */
  parseStoredEvent(payload: unknown): SmsWebhookEvent;
  /** True when a delivery failure means the recipient opted out. */
  isOptOutError(errors: SmsDeliveryError[] | undefined): boolean;
}
