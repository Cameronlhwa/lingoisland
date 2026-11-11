import { NextResponse } from "next/server";
import { startVerification } from "@/lib/sms/phoneService";
import {
  getClientIp,
  getSmsDeps,
  readJsonBody,
  requireSmsUser,
  smsErrorResponse,
} from "@/lib/sms/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/sms/phone/start
 * { country, phoneNumber, consentVersion, source, channel?, consent? | consentScheduled?, consentJourney? }
 *
 * Responds the same way whether or not the number is linked to another
 * account; ownership conflicts are only surfaced after the code is proven.
 */
export async function POST(request: Request) {
  const { user, response } = await requireSmsUser(request, { mutation: true });
  if (!user) return response;
  if (user.is_anonymous) {
    return NextResponse.json(
      { error: "Create an account first so your number stays private to you.", code: "unauthorized" },
      { status: 401 },
    );
  }
  try {
    const body = await readJsonBody(request);
    const result = await startVerification(getSmsDeps(), {
      userId: user.id,
      ip: getClientIp(request),
      country: body.country,
      phoneNumber: body.phoneNumber,
      consent: body.consent,
      consentVersion: body.consentVersion,
      consentScheduled: body.consentScheduled,
      consentJourney: body.consentJourney,
      channel: body.channel,
      source: body.source,
    });
    return NextResponse.json({
      ...result.state,
      alreadyActive: result.alreadyActive,
      whatsappReplyConnect: result.whatsappReplyConnect,
    });
  } catch (error) {
    return smsErrorResponse(error, "POST /api/sms/phone/start");
  }
}
