import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { detectSmsKeyword } from "@/lib/sms/keywords";
import { logSmsError } from "@/lib/sms/log";
import { processSmsWebhookEvent } from "@/lib/sms/processor";
import { getSmsDeps } from "@/lib/sms/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Telnyx expects a fast 2xx. We verify the signature, durably store the
 * event (deduplicated by provider event id), acknowledge, and process in the
 * background. STOP/START/HELP are handled before acknowledging so an opt-out
 * takes effect immediately. Unprocessed events are retried by
 * /api/cron/sms-process.
 */
export async function POST(request: Request) {
  const deps = getSmsDeps();
  const rawBody = await request.text();

  let event;
  try {
    event = await deps.provider.parseWebhook(request, rawBody);
  } catch (error) {
    logSmsError("webhook rejected", error);
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }

  let recorded: { id: string; duplicate: boolean; pending: boolean };
  try {
    recorded = await deps.rpc("sms_record_webhook_event", {
      p_provider: deps.provider.name,
      p_event_id: event.id,
      p_event_type: event.type,
      p_occurred_at: event.occurredAt,
      p_payload: event.raw,
    });
  } catch (error) {
    // Not stored: let the provider retry delivery.
    logSmsError("webhook persist failed", error);
    return NextResponse.json({ error: "Temporarily unavailable" }, { status: 500 });
  }

  const isKeyword =
    event.type === "message.received" && Boolean(event.message && detectSmsKeyword(event.message.body));
  if (recorded.pending && isKeyword) {
    try {
      await processSmsWebhookEvent(deps, recorded.id);
    } catch (error) {
      // Stored; the cron retries it.
      logSmsError("keyword processing failed", error, { eventRowId: recorded.id });
    }
  } else if (recorded.pending) {
    waitUntil(
      processSmsWebhookEvent(deps, recorded.id).catch((error) =>
        logSmsError("background processing failed", error, { eventRowId: recorded.id }),
      ),
    );
  }

  return NextResponse.json({ received: true, duplicate: recorded.duplicate });
}
