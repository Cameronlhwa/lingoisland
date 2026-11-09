import { NextResponse } from "next/server";
import { isStepId } from "@/lib/onboarding/personalized/flow";
import { readBody, requireOnboardingUser } from "@/lib/onboarding/personalized/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/onboarding/abandon { step, lastCompletedStep }. Sent with sendBeacon when the page is hidden. */
export async function POST(request: Request) {
  const { user, response } = await requireOnboardingUser(request, { mutation: true, allowAnonymous: true });
  if (!user) return response;
  const body = await readBody(request);
  if (!isStepId(body.step)) return NextResponse.json({ status: "ignored" });
  const last = isStepId(body.lastCompletedStep) ? body.lastCompletedStep : null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("onboarding_mark_abandoned", { p_step: body.step, p_last_completed_step: last });
  if (error) return NextResponse.json({ status: "ignored" });
  return NextResponse.json({ status: "recorded" });
}
