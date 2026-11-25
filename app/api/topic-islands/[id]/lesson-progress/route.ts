import { verifyLessonAdvance } from "@/lib/journey/teaching/assessment";
import { NextResponse } from "next/server";
import { lessonAccess, LessonError } from "@/lib/journey/teaching/store";
import { updateLessonProgress } from "@/lib/journey/teaching/curriculum";
import { lessonBody, lessonFailure } from "@/lib/journey/teaching/http";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try { const { row } = await lessonAccess(params.id); return NextResponse.json({ lesson: row.content, progress: row.progress, revision: row.revision }); }
  catch (error) { return lessonFailure(error); }
}
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await lessonBody(request);
    const { db, user, row } = await lessonAccess(params.id);
    if (!row.content) throw new LessonError("Prepare the teaching content first", 409);
    if (!Number.isInteger(body.revision) || body.revision !== row.revision) throw new LessonError("This lesson changed in another tab. Reload to continue.", 409);
    let progress;
    try { progress = updateLessonProgress(row.content, row.progress, body.progress); }
    catch (error) { throw new LessonError((error as Error).message, 400); }
    verifyLessonAdvance(row.content, row.progress, progress, body.evidence, row.writing_approval);
    if (progress.speakingPath === "spoken" && row.progress.stepId === "speaking" && progress.stepId !== "speaking") {
      const { count, error } = await db.from("pronunciation_attempts").select("id", { head: true, count: "exact" }).eq("session_id", row.pronunciation_session_id ?? "00000000-0000-0000-0000-000000000000").eq("user_id", user.id).eq("unit_type", "sentence");
      if (error || !count) throw new LessonError("Record a sentence or choose listening practice", 400);
    }
    if (progress.stepId === "complete" && row.pronunciation_session_id) {
      if (progress.speakingPath === "spoken") {
        const { error } = await db.rpc("complete_pronunciation_session", { p_session_id: row.pronunciation_session_id });
        if (error) throw new LessonError("Could not save your pronunciation practice. Please try again.", 503);
      } else {
        const { error } = await db.from("pronunciation_sessions").update({ status: "abandoned" }).eq("id", row.pronunciation_session_id).eq("user_id", user.id).eq("status", "in_progress");
        if (error) throw new LessonError("Could not save your listening practice");
      }
    }
    const { data, error } = await db.from("journey_lessons").update({ progress, revision: row.revision + 1, updated_at: new Date().toISOString() }).eq("island_id", params.id).eq("user_id", user.id).eq("revision", row.revision).select("progress,revision").maybeSingle();
    if (error) throw new LessonError("Could not save progress");
    if (!data) throw new LessonError("This lesson changed in another tab. Reload to continue.", 409);
    return NextResponse.json(data);
  } catch (error) { return lessonFailure(error); }
}
