import { NextResponse } from "next/server";
import { channelEligibility } from "@/lib/onboarding/personalized/messaging";
import { readBody, requireOnboardingUser, simulationAllowed } from "@/lib/onboarding/personalized/server";
import { getSmsConfig } from "@/lib/sms/config";
import { parsePhoneForSms } from "@/lib/sms/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: whether any messaging is configured, before a number is entered. Reveals no user data. */
export async function GET() {
  const config = getSmsConfig();
  return NextResponse.json({
    smsAvailable: config.enabled && config.supportedCountries.length > 0,
    whatsappAvailable: config.whatsapp.enabled,
    simulationAvailable: simulationAllowed() && !config.enabled,
  });
}

/**
 * POST /api/onboarding/messaging/eligibility { country, phoneNumber }
 * Which channels the entered number can use. The country comes from the
 * number itself (a +44 number typed with "United States" selected is a UK
 * number). Nothing is stored or sent, and the number is never logged.
 */
export async function POST(request: Request) {
  const { user, response } = await requireOnboardingUser(request, { mutation: true, allowAnonymous: false });
  if (!user) return response;
  const body = await readBody(request);
  const config = getSmsConfig();
  const parsed = parsePhoneForSms(
    typeof body.phoneNumber === "string" ? body.phoneNumber : "",
    typeof body.country === "string" ? body.country : undefined,
    "any",
  );
  if (!parsed.ok) {
    return NextResponse.json(
      {
        valid: false,
        reason: parsed.reason,
        error:
          parsed.reason === "not_mobile"
            ? "Please use a mobile number that can receive messages."
            : "That doesn't look like a valid phone number.",
      },
      { status: 200 },
    );
  }
  const eligibility = channelEligibility({
    country: parsed.country,
    smsEnabled: config.enabled,
    smsCountries: config.supportedCountries,
    whatsappEnabled: config.whatsapp.enabled,
    whatsappCountries: config.whatsapp.supportedCountries,
  });
  return NextResponse.json({
    valid: true,
    ...eligibility,
    simulationAvailable: simulationAllowed() && !config.enabled,
  });
}
