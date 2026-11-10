import { NextResponse } from "next/server";
import { captureServerEvent } from "@/lib/posthog/server";
import { getHuahuaOverview, updateHuahuaPreferences } from "@/lib/sms/huahua/settings";
import type { HuahuaUnavailable } from "@/lib/sms/huahua/publicTypes";
import { toPublicState } from "@/lib/sms/phoneService";
import { getSmsDeps, readJsonBody, requireSmsUser, smsErrorResponse } from "@/lib/sms/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/sms/huahua — the signed-in learner's Huahua settings, usage, and history. */
export async function GET(request: Request) {
  const { user, response } = await requireSmsUser(request, { mutation: false });
  if (!user) return response;
  const deps = getSmsDeps();
  try {
    return NextResponse.json(await getHuahuaOverview(deps, user.id));
  } catch (error) {
    if (!deps.config.enabled) {
      const body: HuahuaUnavailable = {
        unavailable: true,
        phone: toPublicState(deps.config, { contact: null, pending: null }),
      };
      return NextResponse.json(body);
    }
    return smsErrorResponse(error, "GET /api/sms/huahua");
  }
}

/** PATCH /api/sms/huahua — update persona, corrections, support, and schedule. */
export async function PATCH(request: Request) {
  const { user, response } = await requireSmsUser(request, { mutation: true });
  if (!user) return response;
  try {
    const body = await readJsonBody(request);
    const overview = await updateHuahuaPreferences(getSmsDeps(), user.id, body);
    void captureServerEvent({
      distinctId: user.id,
      event: "huahua_preferences_updated",
      properties: { fields: Object.keys(body).slice(0, 10) },
    }).catch(() => {});
    return NextResponse.json(overview);
  } catch (error) {
    return smsErrorResponse(error, "PATCH /api/sms/huahua");
  }
}
