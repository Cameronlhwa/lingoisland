import type { SupabaseClient } from "@supabase/supabase-js";
import { getWordsForCurriculumUnit } from "@/lib/hsk/vocabPool";
import { generateHskUnitIslands } from "@/lib/deepseek/generate-hsk-unit-islands";
import type { HskMotivation } from "@/lib/deepseek/generate-hsk-journey";
import { HSK_PATH_STANDARD } from "@/lib/hsk/pathStandard";
import { isFoundationsTag } from "@/lib/hsk/unitSlots";

const HSK_PER_UNIT = 32;
const DEFAULT_DAILY_MINUTES = 15;
const DAYS_PER_WEEK = 4;

// 7-node path: I1(1) · I2(2) · SA(3) · I3(4) · I4(5) · I5(6) · SB(7)
function islandPosition(stepOrder: number): number {
  return stepOrder <= 2 ? stepOrder : stepOrder + 1;
}

export type BuildUnitResult =
  | { ok: true; journeyId: string; alreadyBuilt?: boolean }
  | { ok: false; error: string };

type SeedWord = {
  hanzi: string;
  pinyin: string;
  english: string;
  hsk_word_id: string | null;
  hsk_level: number | null;
};

/**
 * Turns a `curriculum_units` sketch into a real journey: assigns not-yet-learned
 * HSK words, generates the 5-island / 2-story structure + supporting vocab, and
 * writes journeys + journey_islands (with per-island `seed_words`) +
 * journey_island_hsk_words. Island sentence content stays lazy — it is generated
 * per island by /api/journey/[id]/start-island.
 */
export async function buildCurriculumUnit(
  supabase: SupabaseClient,
  { unitId, userId }: { unitId: string; userId: string },
): Promise<BuildUnitResult> {
  const { data: unit, error: unitErr } = await supabase
    .from("curriculum_units")
    .select("*, curricula!inner(id, user_id, hsk_standard)")
    .eq("id", unitId)
    .maybeSingle();

  if (unitErr || !unit) {
    return { ok: false, error: "Curriculum unit not found" };
  }
  const curriculaRel = (unit as { curricula: unknown }).curricula;
  const curriculum = (Array.isArray(curriculaRel)
    ? curriculaRel[0]
    : curriculaRel) as
    | { id: string; user_id: string; hsk_standard: string }
    | undefined;
  if (!curriculum || curriculum.user_id !== userId) {
    return { ok: false, error: "Forbidden" };
  }
  if (unit.status === "ready" && unit.journey_id) {
    return { ok: true, journeyId: unit.journey_id as string, alreadyBuilt: true };
  }

  await supabase.from("curriculum_units").update({ status: "building" }).eq("id", unitId);

  try {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("hsk_personalization_text, hsk_motivation, daily_time_minutes, interests")
      .eq("user_id", userId)
      .maybeSingle();

    const standard = HSK_PATH_STANDARD;
    const personalizationText =
      typeof profile?.hsk_personalization_text === "string"
        ? profile.hsk_personalization_text
        : "";
    const motivation = ((["school", "job", "heritage", "hobby"] as HskMotivation[]).includes(
      profile?.hsk_motivation as HskMotivation,
    )
      ? profile?.hsk_motivation
      : "hobby") as HskMotivation;
    const dailyMinutes =
      typeof profile?.daily_time_minutes === "number" && profile.daily_time_minutes > 0
        ? profile.daily_time_minutes
        : DEFAULT_DAILY_MINUTES;
    const wordsPerWeek = Math.round((dailyMinutes / 15) * DAYS_PER_WEEK * 10);

    // Words already committed to sibling units of this curriculum.
    const { data: siblings } = await supabase
      .from("curriculum_units")
      .select("id, hsk_word_ids")
      .eq("curriculum_id", curriculum.id)
      .neq("id", unitId);
    const excludeWordIds = (siblings ?? []).flatMap(
      (s) => (s.hsk_word_ids ?? []) as string[],
    );

    const userInterests = Array.isArray(profile?.interests)
      ? (profile?.interests as string[])
      : [];
    const interestTag = (unit.interest_tag as string) ?? "";
    const foundations = isFoundationsTag(interestTag);

    const words = await getWordsForCurriculumUnit(supabase, {
      userId,
      standard,
      level: unit.milestone_level as number,
      excludeWordIds,
      interestTag,
      userInterests,
      foundations,
      targetCount: HSK_PER_UNIT,
    });

    const wordByHanzi = new Map(words.map((w) => [w.hanzi, w]));

    const plan = await generateHskUnitIslands({
      unitTitle: unit.title as string,
      theme: (unit.theme as string) ?? "",
      interestTag,
      milestoneLevel: unit.milestone_level as number,
      hskWords: words.map((w) => ({
        hanzi: w.hanzi,
        pinyin: w.pinyin,
        english: w.english,
      })),
      foundations,
      personalizationText,
      userInterests,
    });

    // ---- journeys row ----
    const { data: journey, error: jErr } = await supabase
      .from("journeys")
      .insert({
        user_id: userId,
        topic: unit.title,
        why: personalizationText || (unit.theme as string) || null,
        time_label: null,
        days_per_week: DAYS_PER_WEEK,
        words_per_week: wordsPerWeek,
        curriculum_unit_id: unitId,
      })
      .select("id")
      .single();

    if (jErr || !journey) {
      throw new Error(jErr?.message || "Failed to create unit journey");
    }

    // ---- journey_islands nodes ----
    const assignedWordIds: string[] = [];
    const islandRows = plan.islands.map((island) => {
      const stepOrder = island.position; // 1..5
      const hskSeeds: SeedWord[] = island.hskHanzi
        .map((hanzi) => wordByHanzi.get(hanzi))
        .filter((w): w is NonNullable<typeof w> => !!w)
        .map((w) => {
          assignedWordIds.push(w.id);
          return {
            hanzi: w.hanzi,
            pinyin: w.pinyin,
            english: w.english ?? "",
            hsk_word_id: w.id,
            hsk_level: w.level,
          };
        });
      const fillerSeeds: SeedWord[] = island.filler.map((f) => ({
        hanzi: f.hanzi,
        pinyin: f.pinyin,
        english: f.english,
        hsk_word_id: null,
        hsk_level: null,
      }));
      const seedWords = [...hskSeeds, ...fillerSeeds];
      return {
        journey_id: journey.id,
        step_order: stepOrder,
        position: islandPosition(stepOrder),
        node_type: "island" as const,
        name: island.name,
        zh: island.zh,
        story_idea: null,
        word_count: stepOrder === 1 ? 5 : 10,
        hint: null,
        seed_words: seedWords,
      };
    });

    const storyRows = plan.stories.map((story) => ({
      journey_id: journey.id,
      step_order: story.afterIsland === 2 ? 102 : 105,
      position: story.afterIsland === 2 ? 3 : 7,
      node_type: "story" as const,
      name: story.title,
      zh: null,
      story_idea: null,
      word_count: null,
      hint: story.hint,
      seed_words: null,
    }));

    const { data: insertedNodes, error: niErr } = await supabase
      .from("journey_islands")
      .insert([...islandRows, ...storyRows])
      .select("id, step_order, node_type, seed_words");

    if (niErr || !insertedNodes) {
      await supabase.from("journeys").delete().eq("id", journey.id);
      throw new Error(niErr?.message || "Failed to create unit islands");
    }

    // ---- tag HSK words per island (map badges) ----
    const tagRows: { journey_island_id: string; hsk_word_id: string }[] = [];
    for (const node of insertedNodes) {
      if (node.node_type !== "island") continue;
      const seeds = (node.seed_words as SeedWord[] | null) ?? [];
      for (const s of seeds) {
        if (s.hsk_word_id) {
          tagRows.push({ journey_island_id: node.id, hsk_word_id: s.hsk_word_id });
        }
      }
    }
    if (tagRows.length > 0) {
      const { error: tagErr } = await supabase
        .from("journey_island_hsk_words")
        .insert(tagRows);
      if (tagErr) {
        console.warn("[buildCurriculumUnit] journey_island_hsk_words insert", tagErr);
      }
    }

    // ---- finalize the unit ----
    await supabase
      .from("curriculum_units")
      .update({
        status: "ready",
        journey_id: journey.id,
        hsk_word_ids: Array.from(new Set(assignedWordIds)),
      })
      .eq("id", unitId);

    if ((unit.unit_number as number) === 1) {
      await supabase
        .from("profiles")
        .update({ active_journey_id: journey.id })
        .eq("id", userId);
    }

    return { ok: true, journeyId: journey.id as string };
  } catch (e) {
    await supabase
      .from("curriculum_units")
      .update({ status: "sketch" })
      .eq("id", unitId);
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to build unit",
    };
  }
}
