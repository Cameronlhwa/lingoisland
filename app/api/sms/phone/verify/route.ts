import { NextResponse } from "next/server";
import { captureServerEvent } from "@/lib/posthog/server";
import { verifyPhoneCode } from "@/lib/sms/phoneService";
import { getSmsDeps, readJsonBody, requireSmsUser, smsErrorResponse } from "@/lib/sms/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function learnerName(metadata: Record<string, unknown> | undefined) {
  for (const key of ["full_name", "name", "first_name"]) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim().split(/\s+/)[0];
  }
  return null;
}

/** POST /api/sms/phone/verify { code, confirmTransfer?, welcome?: "deferred" } */
export async function POST(request: Request) {
  const { user, response } = await requireSmsUser(request, { mutation: true });
  if (!user) return response;
  try {
    const body = await readJsonBody(request);

    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("cefr_level")
      .eq("user_id", user.id)
      .maybeSingle();

    const result = await verifyPhoneCode(getSmsDeps(), {
      userId: user.id,
      code: body.code,
      confirmTransfer: body.confirmTransfer,
      displayName: learnerName(user.user_metadata),
      languageLevel: typeof profile?.cefr_level === "string" ? profile.cefr_level : null,
      welcome: body.welcome === "deferred" ? "deferred" : "default",
    });

    if (!result.alreadyVerified) {
      void captureServerEvent({
        distinctId: user.id,
        event: "sms_phone_verified",
        properties: {
          replaced: result.replaced,
          transferred: result.transferred,
          country: result.state.contact?.countryCode ?? null,
          channel: result.state.contact?.channel ?? "sms",
        },
      }).catch(() => {});
    }

    return NextResponse.json({
      ...result.state,
      replaced: result.replaced,
      transferred: result.transferred,
    });
  } catch (error) {
    return smsErrorResponse(error, "POST /api/sms/phone/verify");
  }
}
