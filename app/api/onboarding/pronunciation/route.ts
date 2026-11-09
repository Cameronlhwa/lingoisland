import { NextResponse } from "next/server";
import { getOriginFromRequest } from "@/lib/utils/origin";
import { isPronunciationWord, needsToneSupport } from "@/lib/onboarding/personalized/pronunciation";
import { normalizeSpeechSuperResult } from "@/lib/pronunciation/normalizeScore";
import { checkAndIncrementUsage } from "@/lib/pronunciation/rateLimit";
import { scoreWithSpeechSuper } from "@/lib/speechsuper/client";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

/** Multipart uploads cannot use the JSON content-type guard, so the Origin header must match. */
function isSameOriginUpload(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin) return fetchSite === "same-origin";
  const allowed = new Set([getOriginFromRequest(request)]);
  try {
    allowed.add(new URL(request.url).origin);
  } catch {
    // ignore malformed request URLs
  }
  return allowed.has(origin);
}

function unavailable() {
  return NextResponse.json({ status: "unavailable" });
}

/**
 * POST /api/onboarding/pronunciation (multipart: audio, targetText)
 * Optional onboarding check. Returns only whether extra tone support would
 * help; no score is returned, and the audio is never stored. Any failure is
 * "unavailable" so onboarding simply continues.
 */
export async function POST(request: Request) {
  if (!isSameOriginUpload(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const appKey = process.env.SPEECHSUPER_APP_KEY;
  const secretKey = process.env.SPEECHSUPER_SECRET_KEY;
  if (!appKey || !secretKey) return unavailable();

  try {
    const form = await request.formData();
    const targetText = form.get("targetText");
    const audio = form.get("audio");
    if (!isPronunciationWord(targetText) || !(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) return NextResponse.json({ error: "Recording is too long" }, { status: 413 });

    const usage = await checkAndIncrementUsage(supabase, user.id);
    if (!usage.ok) return unavailable();

    const raw = await scoreWithSpeechSuper({
      appKey,
      secretKey,
      userId: user.id,
      mode: Array.from(targetText).length > 1 ? "sentence" : "word",
      referenceText: targetText,
      audio: new Blob([await audio.arrayBuffer()], { type: "audio/wav" }),
    });
    const normalized = normalizeSpeechSuperResult(raw, targetText);
    return NextResponse.json({
      status: "ok",
      needsToneSupport: needsToneSupport({ overall: normalized.overall, tone: normalized.tone }),
    });
  } catch {
    return unavailable();
  }
}
