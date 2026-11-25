import { createHash } from "node:crypto";
import { limitLessonRequests } from "@/lib/journey/teaching/rateLimit";
import { NextResponse } from "next/server";
import { lessonAccess, LessonError } from "@/lib/journey/teaching/store";
import { grammarSteps } from "@/lib/onboarding/personalized/firstLesson/grammarSequence";
import { gradeWriting } from "@/lib/onboarding/personalized/firstLesson/writingGrader";
import { lessonBody, lessonFailure } from "@/lib/journey/teaching/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await lessonBody(request, 8000);
    const { row, user, db } = await lessonAccess(params.id);
    limitLessonRequests(user.id, "writing", 30);
    if (!row.content || typeof body.answer !== "string" || !body.answer.trim() || body.answer.length > 600 || body.stepId !== row.progress.stepId) throw new LessonError("Invalid writing task", 400);
    const step = grammarSteps(row.content.curriculum).find(item => item.id === body.stepId);
    if (!step || step.kind === "teach" || step.practice.kind !== "writing") throw new LessonError("Unknown writing task", 400);
    const grade = await gradeWriting(step.practice, body.answer);
    if (grade.status === "correct") {
      const { error } = await db.from("journey_lessons").update({ writing_approval: { stepId: body.stepId, answerHash: createHash("sha256").update(body.answer).digest("hex") } }).eq("island_id", params.id).eq("user_id", user.id);
      if (error) throw new LessonError("Could not save your writing feedback");
    }
    return NextResponse.json(grade, { status: grade.status === "unavailable" ? 503 : 200 });
  } catch (error) { return lessonFailure(error); }
}
