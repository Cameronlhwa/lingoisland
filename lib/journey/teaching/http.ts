import { NextResponse } from "next/server";
import { LessonError } from "./errors";
import { isSameOriginMutation } from "@/lib/security/sameOrigin";

export async function lessonBody(request: Request, limit = 48000): Promise<Record<string, unknown>> {
  if (!isSameOriginMutation(request)) throw new LessonError("Forbidden", 403);
  const raw = await request.text();
  if (raw.length > limit) throw new LessonError("Request too large", 413);
  try {
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw Error();
    return body;
  } catch { throw new LessonError("Invalid request", 400); }
}
export function lessonFailure(error: unknown) {
  if (error instanceof LessonError) return NextResponse.json({ error: error.message }, { status: error.status });
  console.error("[journey teaching]", error);
  return NextResponse.json({ error: "Could not save your lesson. Please try again." }, { status: 500 });
}
