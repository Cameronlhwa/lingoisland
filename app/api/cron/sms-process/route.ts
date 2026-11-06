/**
 * SMS background work, run every few minutes:
 * 1. Retries webhook events that were stored but not processed.
 * 2. Plans today's scheduled Huahua openers.
 * 3. Runs due opener jobs (Journey and scheduled), applying every gate.
 * 4. Prunes expired SMS data and redacts message text past retention.
 *
 * Protected by CRON_SECRET. Each step is isolated so one failure doesn't
 * block the rest. Only counts are returned or logged.
 */

import { NextRequest, NextResponse } from "next/server";
import { planScheduledOpeners, runDueJobs } from "@/lib/sms/huahua/openers";
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
const MESSAGE_RETENTION_DAYS = 90;
const JOB_RETENTION_DAYS = 30;

async function step<T>(name: string, run: () => Promise<T>): Promise<T | { error: true }> {
  try {
    return await run();
  } catch (error) {
    logSmsError(`sms-process ${name} failed`, error);
    return { error: true };
  }
}

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

  let deps;
  try {
    deps = getSmsDeps();
  } catch (error) {
    logSmsError("sms-process setup failed", error);
    return NextResponse.json({ error: "SMS processing failed" }, { status: 500 });
  }
  if (!deps.config.enabled) {
    return NextResponse.json({ skipped: "sms_not_configured" });
  }

  const webhooks = await step("webhook retries", async () => {
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
    return { processed: ids?.length ?? 0, outcomes };
  });

  const planned = await step("opener planning", () => planScheduledOpeners(deps));
  const jobs = await step("opener jobs", () => runDueJobs(deps));

  const cleanup = await step("cleanup", () =>
    deps.rpc("sms_cleanup", { p_webhook_retention_days: 30, p_verification_retention_days: 30 }),
  );
  const retention = await step("retention", () =>
    deps.rpc("sms_retention_cleanup", {
      p_message_days: MESSAGE_RETENTION_DAYS,
      p_job_days: JOB_RETENTION_DAYS,
    }),
  );

  return NextResponse.json({ webhooks, planned, jobs, cleanup, retention });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
