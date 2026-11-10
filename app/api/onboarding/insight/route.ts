import { NextResponse } from "next/server";
import { parseAnswers } from "@/lib/onboarding/personalized/flow";
import { templateInsight } from "@/lib/onboarding/personalized/insight";
import { generateInsight } from "@/lib/onboarding/personalized/insightModel";
import { readBody } from "@/lib/onboarding/personalized/server";
import { isSameOriginMutation } from "@/lib/security/sameOrigin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Guests reach this before they have an account, so it is limited per IP.
// In-memory and per server instance: a soft cap on cost, not a security boundary.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, { count: number; resetAt: number }>();

function allow(ip: string, now = Date.now()) {
  if (hits.size > 5000) {
    hits.forEach((entry, key) => {
      if (entry.resetAt <= now) hits.delete(key);
    });
  }
  const entry = hits.get(ip);
  if (!entry || entry.resetAt <= now) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_PER_WINDOW;
}

/**
 * POST /api/onboarding/insight { answers } -> { insight }.
 * Writes the "Did we get this right?" playback. Always answers 200 with a
 * usable playback; the template stands in when the model can't be used.
 * Nothing is stored here and the answers are never logged.
 */
export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await readBody(request);
  const answers = parseAnswers(body.answers);
  if (!answers.goal.primary || !answers.usingPain.keys.length) {
    return NextResponse.json({ error: "Answers are incomplete" }, { status: 400 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  if (!allow(ip)) return NextResponse.json({ insight: templateInsight(answers), reason: "limited" });

  const { insight, reason, problem } = await generateInsight(answers);
  // Which rule a rejected reply broke is shown only in development; it never contains the answers.
  return NextResponse.json(process.env.NODE_ENV === "production" ? { insight, reason } : { insight, reason, problem: problem ?? null });
}
