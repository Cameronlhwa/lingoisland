import { loadJourneyVocabulary } from "@/lib/journey/teaching/vocabularyHistory";
import { generateJourneyGrammar, validGrammarVocabulary } from "@/lib/journey/teaching/grammarGeneration";
import { limitLessonRequests } from "@/lib/journey/teaching/rateLimit";
import { NextResponse } from "next/server";
import { type GrammarPoint } from "@/lib/deepseek/generate-grammar-focus";
import { compileJourneyLesson } from "@/lib/journey/teaching/curriculum";
import { lessonAccess, LessonError, readLesson } from "@/lib/journey/teaching/store";
import { lessonBody, lessonFailure } from "@/lib/journey/teaching/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await lessonBody(request);
    const { db, user, island, row } = await lessonAccess(params.id);
    limitLessonRequests(user.id, "prepare", 10);
    if (row.content) return NextResponse.json({ lesson: row.content, progress: row.progress, revision: row.revision });
    const { data: words, error } = await db.from("island_words").select("id,hanzi,pinyin,english,position").eq("island_id", island.id).order("position");
    if (error || !words?.length) throw new LessonError("Prepare the island vocabulary first", 409);
    const { data: focus } = await db.from("island_grammar_focus").select("id,hanzi,pinyin,english,pattern,when_to_use").eq("island_id", island.id).order("position").limit(1).maybeSingle();
    const { data: examples } = focus ? await db.from("island_grammar_examples").select("tier,hanzi,pinyin,english").eq("grammar_focus_id", focus.id) : { data: null };
    const policy = await loadJourneyVocabulary(db, user.id, island.id, row.objective.level, words.map(word => word.hanzi), row.objective.pattern);
    const pieces = row.objective.pattern.split(/[\s…./]+/).filter(Boolean);
    const reusable = focus && examples?.length === 2 && examples.some(example => example.tier === "warmup") && examples.some(example => example.tier === "target") && pieces.every(piece => examples.some(example => example.hanzi.includes(piece)));
    const cached = reusable ? { ...focus, whenToUse: focus!.when_to_use, examples: [examples![0], examples![1]] } as GrammarPoint : null;
    const point = cached && validGrammarVocabulary(cached, policy) ? cached : await generateJourneyGrammar(island.topic, row.objective, policy);
    const content = compileJourneyLesson(island.id, island.topic, row.objective, point, words);
    // A concurrent prepare may finish first. Never replace the winning snapshot.
    const { error: saveError } = await db.from("journey_lessons").update({ content, updated_at: new Date().toISOString() }).eq("island_id", island.id).eq("user_id", user.id).is("content", null);
    if (saveError) throw new LessonError("Could not save teaching content");
    const saved = await readLesson(db, island.id, user.id);
    if (!saved?.content) throw new LessonError("Could not load teaching content");
    return NextResponse.json({ lesson: saved.content, progress: saved.progress, revision: saved.revision });
  } catch (error) { return lessonFailure(error); }
}
