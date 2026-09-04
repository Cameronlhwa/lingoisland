import type { SupabaseClient } from "@supabase/supabase-js";
import { generateHskCurriculum } from "@/lib/deepseek/generate-hsk-curriculum";
import type { HskMotivation } from "@/lib/deepseek/generate-hsk-journey";
import { HSK_PATH_MAX_LEVEL, HSK_PATH_STANDARD } from "@/lib/hsk/pathStandard";
import {
  buildCurriculumSlots,
  themedUnitCountFromRemaining,
} from "@/lib/hsk/unitSlots";
import { countUnlearnedHskWords } from "@/lib/hsk/vocabPool";

const MIN_UNLEARNED_FOR_MILESTONE = 8;
const MIN_INTERESTS = 3;

const MOTIVATIONS: HskMotivation[] = ["school", "job", "heritage", "hobby"];

type ProfileForCurriculum = {
  hsk_standard: string | null;
  hsk_current_level: number | null;
  hsk_target_level: number | null;
  hsk_motivation: string | null;
  hsk_personalization_text: string | null;
  interests: string[] | null;
};

async function loadProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileForCurriculum | null> {
  const { data } = await supabase
    .from("user_profiles")
    .select(
      "hsk_standard, hsk_current_level, hsk_target_level, hsk_motivation, hsk_personalization_text, interests",
    )
    .eq("user_id", userId)
    .maybeSingle();
  return (data as ProfileForCurriculum) ?? null;
}

async function resolveMilestoneLevel(
  supabase: SupabaseClient,
  {
    userId,
    floor,
    target,
  }: { userId: string; floor: number; target: number },
): Promise<number> {
  for (let level = Math.max(1, floor); level <= target; level++) {
    const remaining = await countUnlearnedHskWords(supabase, {
      userId,
      standard: HSK_PATH_STANDARD,
      level,
    });
    if (remaining >= MIN_UNLEARNED_FOR_MILESTONE) return level;
  }
  return target;
}

export async function sketchMilestoneUnits(
  supabase: SupabaseClient,
  {
    curriculumId,
    userId,
    milestoneLevel,
    profile,
  }: {
    curriculumId: string;
    userId: string;
    milestoneLevel: number;
    profile?: ProfileForCurriculum | null;
  },
) {
  const prof = profile ?? (await loadProfile(supabase, userId));
  if (!prof) return [];

  const remaining = await countUnlearnedHskWords(supabase, {
    userId,
    standard: HSK_PATH_STANDARD,
    level: milestoneLevel,
  });
  if (remaining < 1) return [];

  const interests = (prof.interests ?? []).filter((t) => t.trim().length > 0);
  if (interests.length < MIN_INTERESTS) return [];

  const themedCount = themedUnitCountFromRemaining(remaining);
  const slots = buildCurriculumSlots(themedCount, interests);
  const motivation = (MOTIVATIONS.includes(prof.hsk_motivation as HskMotivation)
    ? prof.hsk_motivation
    : "hobby") as HskMotivation;

  const sketches = await generateHskCurriculum({
    milestoneLevel,
    slots,
    interests,
    motivation,
    personalizationText: prof.hsk_personalization_text ?? "",
  });

  const { data: existing } = await supabase
    .from("curriculum_units")
    .select("unit_number")
    .eq("curriculum_id", curriculumId)
    .order("unit_number", { ascending: false })
    .limit(1);
  const startNumber = ((existing?.[0]?.unit_number as number) ?? 0) + 1;

  const rows = sketches.map((s, idx) => ({
    curriculum_id: curriculumId,
    unit_number: startNumber + idx,
    milestone_level: milestoneLevel,
    title: s.title,
    title_zh: s.title_zh || null,
    theme: s.theme || null,
    interest_tag: s.interest_tag || null,
    status: "sketch" as const,
  }));

  const { error } = await supabase.from("curriculum_units").insert(rows);
  if (error) {
    console.error("[curriculum] sketch insert failed", error);
    return [];
  }
  return sketches;
}

export async function createCurriculumForUser(
  supabase: SupabaseClient,
  { userId }: { userId: string },
): Promise<
  | { ok: true; curriculumId: string; milestoneLevel: number }
  | { ok: false; error: string }
> {
  const prof = await loadProfile(supabase, userId);
  if (!prof) return { ok: false, error: "No user profile" };
  if (prof.hsk_target_level == null) {
    return { ok: false, error: "hsk_target_level is required" };
  }
  if (!prof.interests || prof.interests.length < MIN_INTERESTS) {
    return { ok: false, error: "at least three interests are required" };
  }

  const target = Math.min(HSK_PATH_MAX_LEVEL, Math.max(1, prof.hsk_target_level));
  const currentLevel = Math.min(
    HSK_PATH_MAX_LEVEL,
    Math.max(1, prof.hsk_current_level ?? 1),
  );
  const startLevel = Math.min(currentLevel, target);
  const milestoneLevel = await resolveMilestoneLevel(supabase, {
    userId,
    floor: startLevel,
    target,
  });

  await supabase
    .from("curricula")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "active");

  const { data: curriculum, error: cErr } = await supabase
    .from("curricula")
    .insert({
      user_id: userId,
      hsk_standard: HSK_PATH_STANDARD,
      start_level: startLevel,
      target_level: target,
      current_milestone_level: milestoneLevel,
      status: "active",
    })
    .select("id")
    .single();

  if (cErr || !curriculum) {
    return { ok: false, error: cErr?.message || "Failed to create curriculum" };
  }

  await supabase
    .from("user_profiles")
    .update({
      active_curriculum_id: curriculum.id,
      hsk_standard: HSK_PATH_STANDARD,
    })
    .eq("user_id", userId);

  const sketches = await sketchMilestoneUnits(supabase, {
    curriculumId: curriculum.id,
    userId,
    milestoneLevel,
    profile: prof,
  });

  if (sketches.length === 0) {
    await supabase
      .from("curricula")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", curriculum.id);
    return { ok: false, error: "No unlearned HSK vocabulary to build a curriculum from" };
  }

  return { ok: true, curriculumId: curriculum.id as string, milestoneLevel };
}

export async function advanceCurriculumAfterUnitComplete(
  supabase: SupabaseClient,
  { journeyId, userId }: { journeyId: string; userId: string },
): Promise<void> {
  const { data: unit } = await supabase
    .from("curriculum_units")
    .select("id, curriculum_id, milestone_level, status")
    .eq("journey_id", journeyId)
    .maybeSingle();
  if (!unit) return;

  if (unit.status !== "completed") {
    await supabase
      .from("curriculum_units")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", unit.id);
  }

  const { data: curriculum } = await supabase
    .from("curricula")
    .select("id, current_milestone_level, target_level, status")
    .eq("id", unit.curriculum_id)
    .maybeSingle();
  if (!curriculum || curriculum.status !== "active") return;

  const level = curriculum.current_milestone_level as number;
  const { data: levelUnits } = await supabase
    .from("curriculum_units")
    .select("status")
    .eq("curriculum_id", curriculum.id)
    .eq("milestone_level", level);

  const allDone =
    (levelUnits ?? []).length > 0 &&
    (levelUnits ?? []).every((u) => u.status === "completed");
  if (!allDone) return;

  if (level >= (curriculum.target_level as number)) {
    await supabase
      .from("curricula")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", curriculum.id);
    return;
  }

  const prof = await loadProfile(supabase, userId);
  const nextLevel = await resolveMilestoneLevel(supabase, {
    userId,
    floor: level + 1,
    target: Math.min(HSK_PATH_MAX_LEVEL, curriculum.target_level as number),
  });

  await supabase
    .from("curricula")
    .update({ current_milestone_level: nextLevel })
    .eq("id", curriculum.id);

  await sketchMilestoneUnits(supabase, {
    curriculumId: curriculum.id as string,
    userId,
    milestoneLevel: nextLevel,
    profile: prof,
  });
}
