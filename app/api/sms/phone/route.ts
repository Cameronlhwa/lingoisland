import { NextResponse } from "next/server";
import { captureServerEvent } from "@/lib/posthog/server";
import {
  disconnectPhone,
  getPhoneState,
  setTextingPaused,
  SmsPhoneError,
  toPublicState,
} from "@/lib/sms/phoneService";
import { getSmsDeps, readJsonBody, requireSmsUser, smsErrorResponse } from "@/lib/sms/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/sms/phone — masked texting status for the signed-in learner. */
export async function GET(request: Request) {
  const { user, response } = await requireSmsUser(request, { mutation: false });
  if (!user) return response;
  const deps = getSmsDeps();
  try {
    return NextResponse.json(await getPhoneState(deps, user.id));
  } catch (error) {
    // When texting isn't configured (e.g. local dev without Telnyx or the
    // SMS migrations), show it as unavailable rather than as an error.
    if (!deps.config.enabled) {
      return NextResponse.json(toPublicState(deps.config, { contact: null, pending: null }));
    }
    return smsErrorResponse(error, "GET /api/sms/phone");
  }
}

/** PATCH /api/sms/phone { action: "pause" | "resume" } */
export async function PATCH(request: Request) {
  const { user, response } = await requireSmsUser(request, { mutation: true });
  if (!user) return response;
  try {
    const body = await readJsonBody(request);
    if (body.action !== "pause" && body.action !== "resume") {
      throw new SmsPhoneError("bad_request", 400, "Invalid request.");
    }
    const result = await setTextingPaused(getSmsDeps(), user.id, body.action === "pause");
    void captureServerEvent({
      distinctId: user.id,
      event: body.action === "pause" ? "sms_texting_paused" : "sms_texting_resumed",
    }).catch(() => {});
    return NextResponse.json(result.state);
  } catch (error) {
    return smsErrorResponse(error, "PATCH /api/sms/phone");
  }
}

/** DELETE /api/sms/phone — disconnects the number (history is retained). */
export async function DELETE(request: Request) {
  const { user, response } = await requireSmsUser(request, { mutation: true });
  if (!user) return response;
  try {
    const result = await disconnectPhone(getSmsDeps(), user.id);
    void captureServerEvent({ distinctId: user.id, event: "sms_phone_disconnected" }).catch(() => {});
    return NextResponse.json(result.state);
  } catch (error) {
    return smsErrorResponse(error, "DELETE /api/sms/phone");
  }
}
