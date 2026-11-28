import type Stripe from "stripe";

export type StripeWebhookVerification =
  | { ok: true; event: Stripe.Event }
  | { ok: false; status: 400; error: string };

/**
 * Verify a Stripe webhook payload. Callers must not grant entitlements when
 * `ok` is false — unsigned or tampered events are rejected before any DB write.
 */
export function verifyStripeWebhookEvent(opts: {
  stripe: Pick<Stripe, "webhooks">;
  body: string;
  signature: string | null;
  secret: string | undefined;
}): StripeWebhookVerification {
  if (!opts.signature || !opts.secret) {
    return { ok: false, status: 400, error: "Missing Stripe signature" };
  }

  try {
    return {
      ok: true,
      event: opts.stripe.webhooks.constructEvent(
        opts.body,
        opts.signature,
        opts.secret,
      ),
    };
  } catch {
    return { ok: false, status: 400, error: "Invalid signature" };
  }
}
