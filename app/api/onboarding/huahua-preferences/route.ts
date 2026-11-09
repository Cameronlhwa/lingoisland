import { NextResponse } from "next/server";
import { defaultHuahuaPrefs, parseHuahuaPrefs, toSmsPreferencePatch } from "@/lib/onboarding/personalized/huahua";
import { clampLevel } from "@/lib/onboarding/personalized/levels";
import { validatePreferencesPatch } from "@/lib/sms/huahua/settings";
import { getSmsDeps, readJsonBody, requireSmsUser, smsErrorResponse } from "@/lib/sms/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/onboarding/huahua-preferences { prefs, level }
 * Applies the choices made on the web (writing system, time zone, quiet
 * hours) to the learner's settings. Support, corrections, and frequency are
 * set by the free preview chat, so they are never overwritten from here.
 */
export async function POST(request: Request) {
  const { user, response } = await requireSmsUser(request, { mutation: true });
  if (!user) return response;
  if (user.is_anonymous) return NextResponse.json({ error: "Create an account first." }, { status: 401 });
  const deps = getSmsDeps();
  if (!deps.config.enabled) return NextResponse.json({ status: "skipped" });
  try {
    const body = await readJsonBody(request);
    const level = clampLevel(Number(body.level) || 0);
    const prefs = parseHuahuaPrefs(body.prefs, defaultHuahuaPrefs(level, "UTC"));
    const patch = toSmsPreferencePatch(prefs);
    // Same validation as account settings, so onboarding cannot write anything settings could not.
    const validated = validatePreferencesPatch(
      {
        writingSystem: patch.writing_system,
        timezone: patch.timezone,
        quietStart: patch.quiet_start,
        quietEnd: patch.quiet_end,
      },
      [],
    );
    await deps.rpc("sms_update_preferences", { p_user_id: user.id, p_patch: validated });
    return NextResponse.json({ status: "saved" });
  } catch (error) {
    return smsErrorResponse(error, "POST /api/onboarding/huahua-preferences");
  }
}
