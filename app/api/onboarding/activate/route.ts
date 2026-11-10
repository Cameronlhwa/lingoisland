import { NextResponse } from "next/server";
import { planFor, provisionalLevel } from "@/lib/onboarding/personalized/flow";
import { cefrForLevel, hskForLevel } from "@/lib/onboarding/personalized/levels";
import {
  loadProgress,
  readBody,
  requireOnboardingUser,
  saveProgress,
  timezoneFrom,
} from "@/lib/onboarding/personalized/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function timeLabelFor(minutes: number) {
  if (minutes <= 5) return "5min";
  if (minutes <= 15) return "15min";
  if (minutes <= 30) return "30min";
  return "1h+";
}

/** The newest Journey created since the learner committed to this plan, if its islands were saved. */
async function journeyGeneratedSince(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, committedAt: string) {
  const { data: journey } = await supabase
    .from("journeys")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", committedAt)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!journey) return null;
  const { count } = await supabase
    .from("journey_islands")
    .select("id", { count: "exact", head: true })
    .eq("journey_id", journey.id);
  return count ? (journey.id as string) : null;
}

/**
 * POST /api/onboarding/activate
 *
 * { stage: "start", state?, timezone } saves the committed plan (when the
 * browser still holds it), applies the level and goal to the profile, and
 * returns the parameters for the first Journey, or { status: "generated", journeyId }
 * when that Journey already exists.
 *
 * { stage: "complete", journeyId } records activation once and finishes onboarding.
 */
export async function POST(request: Request) {
  const { user, response } = await requireOnboardingUser(request, { mutation: true, allowAnonymous: false });
  if (!user) return response;
  const body = await readBody(request);
  const timezone = timezoneFrom(body.timezone);
  const supabase = await createClient();

  try {
    if (body.stage === "complete") {
      const journeyId = typeof body.journeyId === "string" && UUID.test(body.journeyId) ? body.journeyId : null;
      if (journeyId) {
        const { data: journey } = await supabase.from("journeys").select("id").eq("id", journeyId).eq("user_id", user.id).maybeSingle();
        if (!journey) return NextResponse.json({ error: "Journey not found." }, { status: 404 });
      }
      const { data, error } = await supabase.rpc("onboarding_mark_activated", { p_journey_id: journeyId });
      if (error) throw error;
      const result = data as { status: string; journey_id?: string | null };
      if (result.status === "not_committed") return NextResponse.json({ status: "not_committed" }, { status: 409 });
      await supabase.from("profiles").update({ onboarding_complete: true }).eq("id", user.id);
      return NextResponse.json({ status: result.status, journeyId: result.journey_id ?? journeyId });
    }

    let progress = await loadProgress(supabase, timezone);
    if (progress?.activatedAt) {
      return NextResponse.json({ status: "already_activated", journeyId: progress.activatedJourneyId });
    }
    if (body.state && (!progress || !progress.state.answers.commitment.committedAt)) {
      const saved = await saveProgress(supabase, { state: body.state, currentStep: "paywall", expectedRevision: null, timezone });
      if (saved.status === "saved") progress = saved.progress;
    }
    if (!progress || !progress.state.answers.commitment.committedAt) {
      return NextResponse.json({ status: "not_committed" }, { status: 409 });
    }

    const answers = progress.state.answers;
    const plan = planFor(answers);
    const level = provisionalLevel(answers);
    const cefrLevel = cefrForLevel(level);
    const learningGoal = [plan.goalPhrase, ...plan.interests].filter(Boolean).join(" · ").slice(0, 200);

    const { data: existing } = await supabase.from("user_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
    const profileFields = { cefr_level: cefrLevel, hsk_current_level: hskForLevel(level), learning_goal: learningGoal };
    if (existing) {
      await supabase.from("user_profiles").update(profileFields).eq("user_id", user.id);
    } else {
      await supabase.from("user_profiles").insert({ user_id: user.id, ...profileFields });
    }

    // A Journey already generated for this plan (another tab, a reload, or a
    // retry after "complete" failed) is reused rather than generated again.
    const committedAt = answers.commitment.committedAt;
    const existingJourneyId = committedAt ? await journeyGeneratedSince(supabase, user.id, committedAt) : null;
    if (existingJourneyId) return NextResponse.json({ status: "generated", journeyId: existingJourneyId });

    return NextResponse.json({
      status: "ready",
      journey: {
        topic: plan.journeyTopic,
        why: learningGoal,
        learningGoal,
        level: cefrLevel,
        cefrLevel,
        dailyMinutes: plan.minutesPerDay,
        daysPerWeek: plan.daysPerWeek,
        timeLabel: timeLabelFor(plan.minutesPerDay),
      },
    });
  } catch (error) {
    console.error("[onboarding/activate] failed", (error as { code?: string })?.code ?? "error");
    return NextResponse.json({ error: "Could not activate your plan. Please try again." }, { status: 500 });
  }
}
