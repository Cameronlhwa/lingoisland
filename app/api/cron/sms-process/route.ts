/**
 * Retries SMS webhook events that were stored but not processed (e.g. the
 * background task was cut off), then prunes expired SMS data.
 *
 * Protected by CRON_SECRET. Schedule it with Vercel Cron (Pro plans allow
 * minute-level schedules) or any external scheduler.
 */

import { NextRequest, NextResponse } from "next/server";
import { logSmsError } from "@/lib/sms/log";
import {
  WEBHOOK_LEASE_SECONDS,
  WEBHOOK_MAX_ATTEMPTS,
  processSmsWebhookEvent,
} from "@/lib/sms/processor";
import { getSmsDeps } from "@/lib/sms/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 20;
// Give the inline (waitUntil) run a head start before retrying.
const MIN_EVENT_AGE_SECONDS = 60;

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const headerSecret = request.headers.get("x-cron-secret");
  const hasValidSecret =
    Boolean(cronSecret) &&
    (authHeader === `Bearer ${cronSecret}` || headerSecret === cronSecret);
  if (!hasValidSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deps = getSmsDeps();
    const ids = await deps.rpc<string[]>("sms_list_retryable_webhook_events", {
      p_limit: BATCH_SIZE,
      p_min_age_seconds: MIN_EVENT_AGE_SECONDS,
      p_lease_seconds: WEBHOOK_LEASE_SECONDS,
      p_max_attempts: WEBHOOK_MAX_ATTEMPTS,
    });

    const outcomes: Record<string, number> = {};
    for (const id of ids ?? []) {
      const { outcome } = await processSmsWebhookEvent(deps, id);
      outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
    }

    const cleanup = await deps.rpc("sms_cleanup", {
      p_webhook_retention_days: 30,
      p_verification_retention_days: 30,
    });

    return NextResponse.json({ processed: ids?.length ?? 0, outcomes, cleanup });
  } catch (error) {
    logSmsError("sms-process cron failed", error);
    return NextResponse.json({ error: "SMS processing failed" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
