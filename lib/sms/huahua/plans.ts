import type { PersonaKey } from "./personas";

// Centralized Huahua texting plans. Allowances are in provider segments
// (what the carrier bills), counted for Huahua's metered practice texts.
// Add future tiers here; `upgradeTo` controls whether an upgrade is offered.

export type HuahuaPlanKey = "free" | "subscriber";

export type HuahuaPlan = {
  key: HuahuaPlanKey;
  label: string;
  allowanceSegments: number;
  /** "lifetime" = one-time trial; "billing_month" resets each billing month. */
  period: "lifetime" | "billing_month";
  personas: readonly PersonaKey[];
  proactiveOpeners: boolean;
  /** Show the 80% usage warning text. */
  usageWarning: boolean;
  upgradeTo: HuahuaPlanKey | null;
};

export const HUAHUA_PLANS: Record<HuahuaPlanKey, HuahuaPlan> = {
  free: {
    key: "free",
    label: "Free trial",
    allowanceSegments: 8,
    period: "lifetime",
    personas: ["friendly_friend"],
    proactiveOpeners: false,
    usageWarning: false,
    upgradeTo: null,
  },
  subscriber: {
    key: "subscriber",
    label: "LingoIsland subscription",
    allowanceSegments: 600,
    period: "billing_month",
    personas: ["friendly_friend", "focused_coach", "accountability_partner", "professional_partner"],
    proactiveOpeners: true,
    usageWarning: true,
    upgradeTo: null,
  },
};

export const USAGE_WARNING_RATIO = 0.8;

const LIFETIME_START = new Date("2000-01-01T00:00:00.000Z");
const LIFETIME_END = new Date("9999-01-01T00:00:00.000Z");

export type SubscriptionRow = {
  product: string;
  status: string;
  current_period_end: string | null;
};

export type BillingRow = { plan: string | null; current_period_end: string | null } | null;

function periodOk(end: string | null | undefined, now: Date) {
  return !end || new Date(end).getTime() > now.getTime();
}

/**
 * Mirrors lib/entitlements.ts: product_subscriptions is the source of truth;
 * the legacy profiles.plan only counts for products without a row.
 */
export function resolveSubscription(
  subscriptions: SubscriptionRow[] | null,
  billing: BillingRow,
  now: Date,
): { subscribed: boolean; periodAnchor: string | null } {
  const rows = subscriptions ?? [];
  const active = rows.filter(
    (row) => (row.status === "active" || row.status === "trialing") && periodOk(row.current_period_end, now),
  );
  if (active.length > 0) {
    const preferred = active.find((row) => row.product === "core") ?? active[0];
    return { subscribed: true, periodAnchor: preferred.current_period_end };
  }

  const plan = billing?.plan ?? "free";
  const legacyProducts =
    plan === "both" ? ["core", "hsk"] : plan === "pro" ? ["core"] : plan === "hsk" ? ["hsk"] : [];
  const legacyActive = legacyProducts.some(
    (product) =>
      (subscriptions === null || !rows.some((row) => row.product === product)) &&
      periodOk(billing?.current_period_end, now),
  );
  return { subscribed: legacyActive, periodAnchor: legacyActive ? billing?.current_period_end ?? null : null };
}

export function planFor(subscribed: boolean): HuahuaPlan {
  return subscribed ? HUAHUA_PLANS.subscriber : HUAHUA_PLANS.free;
}

function addMonthsUtc(anchor: Date, months: number) {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      year,
      month,
      Math.min(anchor.getUTCDate(), lastDay),
      anchor.getUTCHours(),
      anchor.getUTCMinutes(),
      anchor.getUTCSeconds(),
    ),
  );
}

/**
 * Monthly usage period containing `now`. Boundaries follow the billing
 * anchor (subscription renewal time) so allowances reset with billing; for
 * yearly plans this still resets monthly. Without an anchor, calendar months.
 */
export function usagePeriod(plan: HuahuaPlan, anchor: string | null, now: Date) {
  if (plan.period === "lifetime") return { start: LIFETIME_START, end: LIFETIME_END };

  const anchorDate = anchor ? new Date(anchor) : null;
  if (!anchorDate || Number.isNaN(anchorDate.getTime())) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return { start, end };
  }

  const monthsBetween =
    (now.getUTCFullYear() - anchorDate.getUTCFullYear()) * 12 + (now.getUTCMonth() - anchorDate.getUTCMonth());
  let k = monthsBetween + 1;
  while (addMonthsUtc(anchorDate, k).getTime() > now.getTime()) k -= 1;
  return { start: addMonthsUtc(anchorDate, k), end: addMonthsUtc(anchorDate, k + 1) };
}

export type UsageState = "ok" | "warning" | "exhausted";

export function summarizeUsage(plan: HuahuaPlan, used: number, periodEnd: Date) {
  const allowance = plan.allowanceSegments;
  const ratio = allowance > 0 ? Math.min(used / allowance, 1) : 1;
  const state: UsageState = used >= allowance ? "exhausted" : ratio >= USAGE_WARNING_RATIO ? "warning" : "ok";
  return {
    used: Math.min(used, allowance),
    allowance,
    ratio,
    state,
    resetsAt: plan.period === "lifetime" ? null : periodEnd.toISOString(),
    // Only subscribers with a higher tier available, and only near the limit.
    showUpgrade: plan.key !== "free" && plan.upgradeTo !== null && ratio >= USAGE_WARNING_RATIO,
  };
}

export function crossedWarning(plan: HuahuaPlan, usedBefore: number, usedAfter: number) {
  if (!plan.usageWarning) return false;
  const threshold = plan.allowanceSegments * USAGE_WARNING_RATIO;
  return usedBefore < threshold && usedAfter >= threshold && usedAfter < plan.allowanceSegments;
}
