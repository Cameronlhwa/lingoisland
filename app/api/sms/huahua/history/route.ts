import { NextResponse } from "next/server";
import { deleteHuahuaHistory } from "@/lib/sms/huahua/settings";
import { getSmsDeps, readJsonBody, requireSmsUser, smsErrorResponse } from "@/lib/sms/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/sms/huahua/history { includeWords?: boolean } — erases message
 * text and conversations. Consent and delivery records are kept.
 */
export async function DELETE(request: Request) {
  const { user, response } = await requireSmsUser(request, { mutation: true });
  if (!user) return response;
  try {
    const body = await readJsonBody(request);
    return NextResponse.json(await deleteHuahuaHistory(getSmsDeps(), user.id, body.includeWords === true));
  } catch (error) {
    return smsErrorResponse(error, "DELETE /api/sms/huahua/history");
  }
}
