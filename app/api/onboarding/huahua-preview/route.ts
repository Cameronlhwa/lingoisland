import { NextResponse } from "next/server";
import { captureServerEvent } from "@/lib/posthog/server";
import { readPreviewState, startHuahuaPreview } from "@/lib/sms/huahua/preview";
import { getSmsDeps, requireSmsUser, smsErrorResponse } from "@/lib/sms/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RawContact = { id: string; status: string; channel?: string | null } | null;

/**
 * POST /api/onboarding/huahua-preview
 * Sends the first free preview message to the learner's own verified,
 * consented number. Sent at most once per contact.
 */
export async function POST(request: Request) {
  const { user, response } = await requireSmsUser(request, { mutation: true });
  if (!user) return response;
  if (user.is_anonymous) return NextResponse.json({ status: "skipped", reason: "account_required" }, { status: 401 });
  const deps = getSmsDeps();
  if (!deps.config.enabled) return NextResponse.json({ status: "unavailable" });
  try {
    const raw = await deps.rpc<{ contact: RawContact }>("sms_get_phone_state", { p_user_id: user.id });
    const contact = raw?.contact;
    if (!contact || contact.status !== "active") return NextResponse.json({ status: "skipped", reason: "no_active_contact" });
    const channel = contact.channel === "whatsapp" ? "whatsapp" : "sms";
    const result = await startHuahuaPreview(deps, { userId: user.id, contactId: contact.id, channel });
    if (result.status === "sent") {
      void captureServerEvent({ distinctId: user.id, event: "huahua_preview_sent", properties: { channel } }).catch(() => {});
    }
    return NextResponse.json({ status: result.status, channel });
  } catch (error) {
    return smsErrorResponse(error, "POST /api/onboarding/huahua-preview");
  }
}

/**
 * GET /api/onboarding/huahua-preview
 * The learner's own preview conversation so the page can mirror it. Only
 * messages the provider accepted are shown, so nothing undelivered is
 * presented as sent.
 */
export async function GET(request: Request) {
  const { user, response } = await requireSmsUser(request, { mutation: false });
  if (!user) return response;
  if (user.is_anonymous) return NextResponse.json({ thread: null, messages: [] });
  const deps = getSmsDeps();
  if (!deps.config.enabled) return NextResponse.json({ thread: null, messages: [] });
  try {
    const data = await deps.rpc<{
      thread: { status?: string; session?: { preview?: unknown } } | null;
      messages: Array<{ direction: string; body: string; at: string; status: string }>;
    } | null>("sms_get_preview_thread", { p_user_id: user.id, p_message_limit: 30 });
    if (!data?.thread) return NextResponse.json({ thread: null, messages: [] });
    const preview = readPreviewState(data.thread.session?.preview);
    return NextResponse.json({
      thread: { stage: preview?.stage ?? "done", open: data.thread.status === "open" },
      preferences:
        preview?.stage === "done"
          ? { support: preview.support, correction: preview.correction, frequency: preview.frequency }
          : null,
      messages: (data.messages ?? []).map((message) => ({
        direction: message.direction === "inbound" ? "inbound" : "outbound",
        body: message.body,
        at: message.at,
        status: message.status,
      })),
    });
  } catch (error) {
    return smsErrorResponse(error, "GET /api/onboarding/huahua-preview");
  }
}
