import { test } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { verifyStripeWebhookEvent } from "../../lib/stripe/webhookSecurity";

const secret = "whsec_regression_test_secret";
const stripe = new Stripe("sk_test_regression_placeholder", {
  apiVersion: "2025-12-15.clover",
});

test("webhook verification rejects missing signature and secret", () => {
  const body = JSON.stringify({ id: "evt_1", object: "event", type: "ping" });
  assert.equal(
    verifyStripeWebhookEvent({
      stripe,
      body,
      signature: null,
      secret,
    }).ok,
    false,
  );
  assert.equal(
    verifyStripeWebhookEvent({
      stripe,
      body,
      signature: "t=1,v1=abc",
      secret: undefined,
    }).ok,
    false,
  );
});

test("webhook verification accepts signed payloads and rejects tampering", () => {
  const body = JSON.stringify({
    id: "evt_regression",
    object: "event",
    type: "customer.subscription.deleted",
    data: { object: { id: "sub_regression" } },
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret,
  });

  const valid = verifyStripeWebhookEvent({
    stripe,
    body,
    signature,
    secret,
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.event.type, "customer.subscription.deleted");
  }

  const tampered = verifyStripeWebhookEvent({
    stripe,
    body: body.replace("deleted", "updated"),
    signature,
    secret,
  });
  assert.equal(tampered.ok, false);
  if (!tampered.ok) {
    assert.equal(tampered.error, "Invalid signature");
  }
});
