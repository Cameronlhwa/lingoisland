import { test } from "node:test";
import assert from "node:assert/strict";
import {
  actionForSubscriptionUpdate,
  hasBlockingStripeSubscriptionStatus,
} from "../../lib/stripe/subscriptionLifecycle";

test("active and trialing subscriptions keep or grant access", () => {
  assert.equal(actionForSubscriptionUpdate("active").type, "upsert_active");
  assert.equal(actionForSubscriptionUpdate("trialing").type, "upsert_active");
});

test("canceled unpaid and incomplete_expired subscriptions revoke access", () => {
  for (const status of ["canceled", "unpaid", "incomplete_expired"] as const) {
    assert.equal(
      actionForSubscriptionUpdate(status).type,
      "revoke",
      status,
    );
  }
});

test("canceled status never re-grants access even when cancel_at_period_end flags remain", () => {
  // Regression: the webhook previously called upsertActiveSubscription when
  // status was "canceled" but cancel_at_period_end / cancel_at was set, writing
  // product_subscriptions.status back to "active" after the period ended.
  assert.equal(actionForSubscriptionUpdate("canceled").type, "revoke");
});

test("past_due incomplete and paused leave prior entitlements untouched", () => {
  for (const status of ["past_due", "incomplete", "paused"] as const) {
    const action = actionForSubscriptionUpdate(status);
    assert.equal(action.type, "ignore", status);
  }
});

test("checkout blocks when Stripe already has a billable subscription", () => {
  assert.equal(hasBlockingStripeSubscriptionStatus("active"), true);
  assert.equal(hasBlockingStripeSubscriptionStatus("trialing"), true);
  assert.equal(hasBlockingStripeSubscriptionStatus("past_due"), true);
  assert.equal(hasBlockingStripeSubscriptionStatus("incomplete"), true);
  assert.equal(hasBlockingStripeSubscriptionStatus("canceled"), false);
  assert.equal(hasBlockingStripeSubscriptionStatus("unpaid"), false);
});
