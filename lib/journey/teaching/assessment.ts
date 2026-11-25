import { createHash } from "node:crypto";
import { grammarSteps } from "@/lib/lessons/grammarSequence";
import type { JourneyLesson, LessonProgress } from "./curriculum";
import { LessonError } from "./errors";

/** UI feedback is immediate; advancement still checks the server's content. */
export function verifyLessonAdvance(lesson: JourneyLesson, before: LessonProgress, after: LessonProgress, evidence: unknown, writing: { stepId: string; answerHash: string } | null) {
  if (before.stepId === after.stepId) return;
  const step = grammarSteps(lesson.curriculum).find(step => step.id === before.stepId);
  if (!step || step.kind === "teach" || step.practice.kind === "reading") return;
  const task = step.practice;
  if (task.kind === "build") {
    if (!Array.isArray(evidence) || evidence.length !== task.build.order.length || evidence.some((id, index) => id !== task.build.order[index])) throw new LessonError("Check your sentence before continuing", 400);
  } else if (task.kind === "choice") {
    if (typeof evidence !== "string" || !task.choices.some(choice => choice.id === evidence) || task.correct && evidence !== task.correct) throw new LessonError("Check your answer before continuing", 400);
  } else {
    const answer = after.writingResponses?.[step.id] ?? "";
    if (writing?.stepId !== step.id || writing.answerHash !== createHash("sha256").update(answer).digest("hex")) throw new LessonError("Check your written answer before continuing", 400);
  }
}
