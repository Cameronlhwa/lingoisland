import { NextResponse } from "next/server";
import { resendVerification } from "@/lib/sms/phoneService";
import { getClientIp, getSmsDeps, requireSmsUser, smsErrorResponse } from "@/lib/sms/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/sms/phone/resend — texts a fresh code to the pending number. */
export async function POST(request: Request) {
  const { user, response } = await requireSmsUser(request, { mutation: true });
  if (!user) return response;
  try {
    const result = await resendVerification(getSmsDeps(), {
      userId: user.id,
      ip: getClientIp(request),
    });
    return NextResponse.json(result.state);
  } catch (error) {
    return smsErrorResponse(error, "POST /api/sms/phone/resend");
  }
}
