import { NextResponse } from "next/server";
import { recordCountryInterest } from "@/lib/sms/huahua/settings";
import { getSmsDeps, readJsonBody, requireSmsUser, smsErrorResponse } from "@/lib/sms/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/sms/huahua/interest { country } — "tell me when texting is available here". */
export async function POST(request: Request) {
  const { user, response } = await requireSmsUser(request, { mutation: true });
  if (!user) return response;
  try {
    const body = await readJsonBody(request);
    return NextResponse.json(await recordCountryInterest(getSmsDeps(), user.id, body.country));
  } catch (error) {
    return smsErrorResponse(error, "POST /api/sms/huahua/interest");
  }
}
