/**
 * Decide how a Stripe `customer.subscription.updated` status should affect
 * local entitlements. Kept pure so regression tests can pin the matrix without
 * standing up Stripe or Supabase.
 *
 * Stripe keeps `status: "active"` while `cancel_at_period_end` is true; access
 * stays until the period ends. Once Stripe moves the subscription to
 * `canceled` (or `unpaid` / `incomplete_expired`), access must be revoked.
 * Re-granting on a canceled object previously left expired customers Pro.
 */
export type SubscriptionLifecycleAction =
  | { type: "upsert_active" }
  | { type: "revoke" }
  | { type: "ignore"; reason: string };

export function actionForSubscriptionUpdate(
  status: string,
): SubscriptionLifecycleAction {
  if (status === "active" || status === "trialing") {
    return { type: "upsert_active" };
  }

  if (
    status === "canceled" ||
    status === "unpaid" ||
    status === "incomplete_expired"
  ) {
    return { type: "revoke" };
  }

  // past_due / incomplete / paused: keep prior entitlements while Stripe retries
  // collection or the customer finishes Checkout authentication.
  return { type: "ignore", reason: `Unhandled subscription status: ${status}` };
}

/** Stripe statuses that mean the customer already has a billable subscription. */
export function hasBlockingStripeSubscriptionStatus(status: string): boolean {
  return (
    status === "active" ||
    status === "trialing" ||
    status === "past_due" ||
    status === "incomplete"
  );
}
