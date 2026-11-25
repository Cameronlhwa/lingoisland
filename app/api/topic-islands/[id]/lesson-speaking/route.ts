import { limitLessonRequests } from "@/lib/journey/teaching/rateLimit";
import { NextResponse } from "next/server";
import { lessonAccess, LessonError, readLesson } from "@/lib/journey/teaching/store";
import { lessonBody, lessonFailure } from "@/lib/journey/teaching/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await lessonBody(request);
    const { db, user, row } = await lessonAccess(params.id);
    limitLessonRequests(user.id, "speaking", 20);
    if (!row.content || !["speaking", "chat", "complete"].includes(row.progress.stepId)) throw new LessonError("Finish the grammar activities first", 409);
    if (row.pronunciation_session_id) return NextResponse.json({ sessionId: row.pronunciation_session_id });
    const target = row.content.speaking, word = row.content.words.find(word => word.id !== "grammar-core") ?? row.content.words[0];
    const { data: session, error } = await db.from("pronunciation_sessions").insert({ user_id: user.id, source: "journey_lesson", status: "in_progress", sentences: [{ wordHanzi: word.hanzi, wordPinyin: word.pinyin, wordEnglish: word.label, sentenceHanzi: target.hanzi, sentencePinyin: target.pinyin, sentenceEnglish: target.meaning }] }).select("id").single();
    if (error || !session) throw new LessonError("Could not start speaking practice");
    const { data: claimed, error: claimError } = await db.from("journey_lessons").update({ pronunciation_session_id: session.id }).eq("island_id", params.id).eq("user_id", user.id).is("pronunciation_session_id", null).select("island_id").maybeSingle();
    if (claimError || !claimed) {
      await db.from("pronunciation_sessions").update({ status: "abandoned" }).eq("id", session.id).eq("user_id", user.id);
      if (claimError) throw new LessonError("Could not save speaking practice");
    }
    const saved = await readLesson(db, params.id, user.id);
    if (!saved?.pronunciation_session_id) throw new LessonError("Could not load speaking practice");
    return NextResponse.json({ sessionId: saved.pronunciation_session_id });
  } catch (error) { return lessonFailure(error); }
}
