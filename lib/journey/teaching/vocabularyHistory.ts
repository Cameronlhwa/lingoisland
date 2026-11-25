import type { LessonClient } from "./store";
import { createVocabularyPolicy } from "./vocabularyPolicy";

type Journey = { id: string; completed_at: string | null };
type Node = { island_id: string | null; journey_id: string; step_order: number; completed_at: string | null };
export function learnedIslandIds(journeys: Journey[], nodes: Node[], current: { journey_id: string; step_order: number; island_id: string }): string[] {
  const owned = new Map(journeys.map(journey => [journey.id, journey]));
  if (!owned.has(current.journey_id)) throw new Error("Journey not found");
  return Array.from(new Set(nodes.filter(node => {
    const journey = owned.get(node.journey_id);
    if (!journey || !node.completed_at || !node.island_id || node.island_id === current.island_id || node.step_order >= 100) return false;
    return node.journey_id === current.journey_id ? node.step_order < current.step_order : !!journey.completed_at;
  }).map(node => node.island_id!)));
}
async function pages<T>(read: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const result: T[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await read(start, start + 499);
    if (error) throw new Error("Could not load learned journey vocabulary");
    result.push(...(data ?? []));
    if (!data || data.length < 500) return result;
  }
}
export async function loadJourneyVocabulary(db: LessonClient, userId: string, islandId: string, level: string, targets: string[], pattern: string) {
  const { data: node, error } = await db.from("journey_islands").select("journey_id,step_order").eq("island_id", islandId).maybeSingle();
  if (error || !node) throw new Error("Journey lesson not found");
  const journeys = await pages<Journey>((start, end) => db.from("journeys").select("id,completed_at").eq("user_id", userId).order("id").range(start, end));
  if (!journeys.some(journey => journey.id === node.journey_id)) throw new Error("Journey not found");
  const relevant = journeys.filter(journey => journey.id === node.journey_id || journey.completed_at).map(journey => journey.id);
  const nodes: Node[] = [];
  for (let i = 0; i < relevant.length; i += 80) {
    nodes.push(...await pages<Node>((start, end) => db.from("journey_islands").select("island_id,journey_id,step_order,completed_at").in("journey_id", relevant.slice(i, i + 80)).not("completed_at", "is", null).order("id").range(start, end)));
  }
  const ids = learnedIslandIds(journeys, nodes, { journey_id: node.journey_id, step_order: node.step_order, island_id: islandId });
  const words: string[] = [];
  for (let i = 0; i < ids.length; i += 80) {
    const rows = await pages<{ hanzi: string }>((start, end) => db.from("island_words").select("hanzi").eq("user_id", userId).in("island_id", ids.slice(i, i + 80)).order("id").range(start, end));
    words.push(...rows.map(row => row.hanzi));
    // Mini-course grammar vocabulary may not be present in island_words.
    const lessons = await pages<{ content: { words?: Array<{ hanzi: string }> } | null; progress: { stepId?: string } | null }>((start, end) => db.from("journey_lessons").select("content,progress").eq("user_id", userId).in("island_id", ids.slice(i, i + 80)).order("island_id").range(start, end));
    for (const lesson of lessons) if (lesson.progress?.stepId === "complete") words.push(...(lesson.content?.words ?? []).map(word => word.hanzi));
  }
  return createVocabularyPolicy(level, targets, words, pattern);
}
