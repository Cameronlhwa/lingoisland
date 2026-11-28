import { createClient } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { selectObjective, type JourneyLesson, type LessonProgress, type TeachingObjective } from "./curriculum";

export type LessonRow = { island_id: string; objective: TeachingObjective; content: JourneyLesson | null; progress: LessonProgress; revision: number; pronunciation_session_id: string | null; writing_approval: { stepId: string; answerHash: string } | null };
import { LessonError } from "./errors";
export { LessonError } from "./errors";
export function isMissingLessonTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}
export type LessonClient = Awaited<ReturnType<typeof createClient>>;

/** Migration-safe read for the existing island API. Never enables the new UI early. */
export async function readLesson(db: LessonClient, islandId: string, userId: string): Promise<LessonRow | null> {
  const { data, error } = await db.from("journey_lessons").select("*").eq("island_id", islandId).eq("user_id", userId).maybeSingle();
  if (isMissingLessonTable(error)) return null;
  if (error) throw new LessonError("Could not load lesson progress");
  return data as LessonRow | null;
}

export async function ensureLesson(db: LessonClient, islandId: string, userId: string): Promise<LessonRow | null> {
  const existing = await readLesson(db, islandId, userId);
  if (existing) return existing;
  const { data: island, error: islandError } = await db.from("topic_islands").select("id,level").eq("id", islandId).eq("user_id", userId).maybeSingle();
  if (islandError || !island) throw new LessonError("Island not found", 404);
  const { data: node, error } = await db.from("journey_islands").select("step_order,journey_id,completed_at").eq("island_id", islandId).maybeSingle();
  if (error) throw new LessonError("Could not load journey");
  // Completed legacy lessons remain unchanged; explicit new lessons get the new flow.
  if (!node || node.completed_at || node.step_order < 1 || node.step_order > 5) return null;
  const objective = selectObjective(island.level, node.step_order);
  const { error: insertError } = await db.from("journey_lessons").upsert({ island_id: islandId, user_id: userId, objective }, { onConflict: "island_id", ignoreDuplicates: true });
  if (isMissingLessonTable(insertError)) return null;
  if (insertError) throw new LessonError("Could not prepare lesson");
  return readLesson(db, islandId, userId);
}

/** Every new lesson endpoint resolves ownership and product access server-side. */
export async function lessonAccess(islandId: string) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new LessonError("Unauthorized", 401);
  const { data: island, error } = await db.from("topic_islands").select("id,topic,level").eq("id", islandId).eq("user_id", user.id).maybeSingle();
  if (error || !island) throw new LessonError("Island not found", 404);
  const { data: node } = await db.from("journey_islands").select("id,journey_id,step_order").eq("island_id", islandId).maybeSingle();
  if (!node) throw new LessonError("Journey lesson not found", 404);
  const { data: journey } = await db.from("journeys").select("id,curriculum_unit_id").eq("id", node.journey_id).eq("user_id", user.id).maybeSingle();
  if (!journey) throw new LessonError("Journey not found", 404);
  const access = await getEntitlements(user.id);
  if (journey.curriculum_unit_id ? !access.isHskPro : !access.isPro) throw new LessonError("A subscription is required for this lesson", 403);
  const row = await ensureLesson(db, islandId, user.id);
  if (!row) throw new LessonError("Journey teaching is not available for this island yet", 409);
  return { db, user, island, node, row };
}
