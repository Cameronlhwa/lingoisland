import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { sendTrackedSms } from "@/lib/sms/outbound";
import { consumeSmsRateLimits } from "@/lib/sms/rateLimit";
import { getSmsDeps, readJsonBody, requireSmsUser } from "@/lib/sms/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_LENGTH = 320;

/**
 * Manual test send to the signed-in learner's own verified number.
 * Disabled unless SMS_MANUAL_SEND_ENABLED=true.
 */
export async function POST(request: Request) {
  if (process.env.SMS_MANUAL_SEND_ENABLED !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { user, response } = await requireSmsUser(request, { mutation: true });
  if (!user) return response;

  try {
    const body = await readJsonBody(request);
    const contactId = String(body.contactId || "");
    const messageBody = String(body.body || "").trim();
    const requestId = typeof body.requestId === "string" && body.requestId ? body.requestId.slice(0, 64) : randomUUID();
    if (!contactId || !messageBody || messageBody.length > MAX_BODY_LENGTH) {
      return NextResponse.json(
        { error: `A contact and message up to ${MAX_BODY_LENGTH} characters are required` },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: contact } = await supabase
      .from("sms_contacts")
      .select("id, status")
      .eq("id", contactId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    if (contact.status !== "active") {
      return NextResponse.json({ error: "This number isn't active for texting" }, { status: 409 });
    }

    const deps = getSmsDeps();
    const limit = await consumeSmsRateLimits(deps.rpc, deps.config.secret, [
      { name: "manual:user:day", identifier: user.id, max: 10, windowSeconds: 24 * 60 * 60 },
    ]);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many test messages today" }, { status: 429 });
    }

    const sent = await sendTrackedSms(deps, {
      contactId: contact.id,
      idempotencyKey: `manual:${user.id}:${requestId}`,
      kind: "manual",
      requireActive: true,
      body: messageBody,
    });

    if (sent.status === "sent") return NextResponse.json({ messageId: sent.messageId, status: "sent" });
    if (sent.status === "skipped") return NextResponse.json({ status: "skipped", reason: sent.reason }, { status: 409 });
    return NextResponse.json({ error: "Unable to send SMS" }, { status: 502 });
  } catch (error) {
    console.error("[SMS SEND]", error instanceof Error ? error.name : "error");
    return NextResponse.json({ error: "Unable to send SMS" }, { status: 500 });
  }
}
