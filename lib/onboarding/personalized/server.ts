import "server-only";
import { NextResponse } from "next/server";
import { isSameOriginMutation } from "@/lib/security/sameOrigin";
import { createClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { isValidTimeZone } from "./huahua";
import { prepareProgressSave, stateFromRow, type ProgressRow, type StoredProgress } from "./save";

export { stateFromRow, type StoredProgress };

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function requireOnboardingUser(
  request: Request,
  { mutation, allowAnonymous }: { mutation: boolean; allowAnonymous: boolean },
) {
  if (mutation && !isSameOriginMutation(request)) {
    return { user: null, response: NextResponse.json({ error: "Invalid request origin." }, { status: 403 }) };
  }
  const { user } = await getAuthenticatedUser();
  if (!user || (!allowAnonymous && user.is_anonymous)) {
    return { user: null, response: NextResponse.json({ error: "Please sign in again.", code: "unauthorized" }, { status: 401 }) };
  }
  return { user, response: null };
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

/** The Huahua preview simulation exists only in local development, never in production. */
export function simulationAllowed() {
  return process.env.NODE_ENV !== "production";
}

export function timezoneFrom(value: unknown) {
  return typeof value === "string" && isValidTimeZone(value) ? value : "UTC";
}

export async function loadProgress(supabase: Supabase, timezone: string) {
  const { data, error } = await supabase.rpc("onboarding_get_progress");
  if (error) throw error;
  return stateFromRow(data as ProgressRow | null, timezone);
}

export type SaveResult =
  | { status: "saved"; progress: StoredProgress }
  | { status: "conflict"; progress: StoredProgress | null }
  | { status: "unauthorized" };

/**
 * Saves untrusted client state. Answers are re-validated and the placement
 * re-scored by parseState; every normalized column is computed here.
 */
export async function saveProgress(
  supabase: Supabase,
  input: { state: unknown; currentStep: unknown; expectedRevision: unknown; timezone: string; recordAssessment?: boolean },
): Promise<SaveResult | { status: "invalid" }> {
  const prepared = prepareProgressSave({ ...input, allowSimulation: simulationAllowed() });
  if (!prepared) return { status: "invalid" };

  const { data, error } = await supabase.rpc("onboarding_save_progress", prepared.saveArgs);
  if (error) throw error;
  const result = data as { status: string; progress?: ProgressRow };
  if (result.status === "unauthorized") return { status: "unauthorized" };
  if (result.status === "conflict") return { status: "conflict", progress: stateFromRow(result.progress, input.timezone) };

  if (input.recordAssessment && prepared.assessmentArgs) {
    const { error: assessmentError } = await supabase.rpc("onboarding_record_assessment", prepared.assessmentArgs);
    if (assessmentError) console.error("[onboarding] assessment record failed", assessmentError.code ?? "error");
  }

  const progress = stateFromRow(result.progress, input.timezone);
  if (!progress) return { status: "invalid" };
  return { status: "saved", progress };
}

export function publicProgress(progress: StoredProgress | null) {
  if (!progress) return null;
  return {
    answers: progress.state.answers,
    events: progress.state.events,
    revision: progress.state.revision,
    updatedAt: progress.state.updatedAt,
    activatedAt: progress.activatedAt,
  };
}
