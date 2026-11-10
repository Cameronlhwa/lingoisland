import { NextResponse } from "next/server";
import {
  loadProgress,
  publicProgress,
  readBody,
  requireOnboardingUser,
  saveProgress,
  timezoneFrom,
} from "@/lib/onboarding/personalized/server";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function firstName(metadata: Record<string, unknown> | undefined) {
  for (const key of ["first_name", "full_name", "name"]) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim().split(/\s+/)[0].slice(0, 40);
  }
  return null;
}

/**
 * GET /api/onboarding/progress?tz=Area/City
 * The account kind (guest, anonymous, or user) and any saved onboarding.
 * Guests get 200 with no progress; their answers live in the browser.
 */
export async function GET(request: Request) {
  const { user } = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ account: { kind: "guest", firstName: null }, progress: null });
  const account = user.is_anonymous
    ? { kind: "anonymous" as const, firstName: null }
    : { kind: "user" as const, firstName: firstName(user.user_metadata) };
  try {
    const tz = timezoneFrom(new URL(request.url).searchParams.get("tz"));
    const progress = await loadProgress(await createClient(), tz);
    return NextResponse.json({ account, progress: publicProgress(progress) });
  } catch (error) {
    console.error("[onboarding/progress] load failed", (error as { code?: string })?.code ?? "error");
    // Still report who is signed in, so a database problem never looks like a signed-out guest.
    return NextResponse.json({ account, error: "Could not load your progress." }, { status: 500 });
  }
}

/**
 * PUT /api/onboarding/progress
 * { state, currentStep, expectedRevision, timezone, recordAssessment? }
 * 409 with the stored progress when another tab saved first.
 */
export async function PUT(request: Request) {
  const { user, response } = await requireOnboardingUser(request, { mutation: true, allowAnonymous: true });
  if (!user) return response;
  try {
    const body = await readBody(request);
    const result = await saveProgress(await createClient(), {
      state: body.state,
      currentStep: body.currentStep,
      expectedRevision: body.expectedRevision,
      timezone: timezoneFrom(body.timezone),
      recordAssessment: body.recordAssessment === true,
    });
    if (result.status === "invalid") return NextResponse.json({ error: "Invalid progress." }, { status: 400 });
    if (result.status === "unauthorized") return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    if (result.status === "conflict") {
      return NextResponse.json({ status: "conflict", progress: publicProgress(result.progress) }, { status: 409 });
    }
    return NextResponse.json({ status: "saved", progress: publicProgress(result.progress) });
  } catch (error) {
    console.error("[onboarding/progress] save failed", (error as { code?: string })?.code ?? "error");
    return NextResponse.json({ error: "Could not save your progress." }, { status: 500 });
  }
}

/** DELETE /api/onboarding/progress resets only the signed-in learner's onboarding session. */
export async function DELETE(request: Request) {
  const { user, response } = await requireOnboardingUser(request, { mutation: true, allowAnonymous: true });
  if (!user) return response;

  try {
    const supabase = await createClient();
    for (const table of ["onboarding_assessment_responses", "onboarding_interests", "onboarding_progress"] as const) {
      const { error } = await supabase.from(table).delete().eq("user_id", user.id);
      if (error) throw error;
    }
    return NextResponse.json({ status: "reset" });
  } catch (error) {
    console.error("[onboarding/progress] reset failed", (error as { code?: string })?.code ?? "error");
    return NextResponse.json({ error: "Could not restart your onboarding." }, { status: 500 });
  }
}
