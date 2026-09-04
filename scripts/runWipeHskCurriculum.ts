/**
 * Executes scripts/wipeHskCurriculum.sql against the live project via
 * the service-role client (same step order). Prints before/after counts.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function countEq(table: string, column?: string, value?: string) {
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  if (column && value !== undefined) q = q.eq(column, value);
  const { count, error } = await q;
  if (error) throw new Error(`${table} count: ${error.message}`);
  return count ?? 0;
}

async function countNotNull(table: string, column: string) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .not(column, "is", null);
  if (error) throw new Error(`${table} count: ${error.message}`);
  return count ?? 0;
}

async function snapshot() {
  const [curricula, curriculum_units, journeys, cards] = await Promise.all([
    countEq("curricula"),
    countEq("curriculum_units"),
    countNotNull("journeys", "curriculum_unit_id"),
    countEq("cards", "source_type", "hsk_word"),
  ]);

  const { data: profiles, error } = await supabase
    .from("user_profiles")
    .select(
      "user_id, hsk_current_level, hsk_level_source, hsk_target_level, test_date, hsk_motivation, hsk_personalization_text, daily_time_minutes, interests, product_track, active_curriculum_id",
    )
    .or(
      "product_track.eq.hsk,hsk_current_level.not.is.null,hsk_target_level.not.is.null,active_curriculum_id.not.is.null",
    );

  if (error) throw new Error(`user_profiles: ${error.message}`);

  return {
    curricula,
    curriculum_units,
    journeys_curriculum: journeys,
    cards_hsk_word: cards,
    hsk_profiles: profiles ?? [],
  };
}

function printSnap(label: string, snap: Awaited<ReturnType<typeof snapshot>>) {
  console.log(`\n=== ${label} ===`);
  console.log(`curricula:                    ${snap.curricula}`);
  console.log(`curriculum_units:             ${snap.curriculum_units}`);
  console.log(`journeys (curriculum-linked): ${snap.journeys_curriculum}`);
  console.log(`cards (source_type=hsk_word): ${snap.cards_hsk_word}`);
  console.log(`HSK user_profiles (${snap.hsk_profiles.length}):`);
  for (const p of snap.hsk_profiles) {
    console.log(
      JSON.stringify(
        {
          user_id: p.user_id,
          product_track: p.product_track,
          hsk_current_level: p.hsk_current_level,
          hsk_level_source: p.hsk_level_source,
          hsk_target_level: p.hsk_target_level,
          test_date: p.test_date,
          hsk_motivation: p.hsk_motivation,
          hsk_personalization_text: p.hsk_personalization_text,
          daily_time_minutes: p.daily_time_minutes,
          interests: p.interests,
          active_curriculum_id: p.active_curriculum_id,
        },
        null,
        2,
      ),
    );
  }
}

async function runWipe() {
  // 1. Null pointers
  const { error: e1 } = await supabase
    .from("user_profiles")
    .update({ active_curriculum_id: null })
    .not("active_curriculum_id", "is", null);
  if (e1) throw new Error(`null active_curriculum_id: ${e1.message}`);

  const { data: linkedJourneys, error: e1b } = await supabase
    .from("journeys")
    .select("id")
    .not("curriculum_unit_id", "is", null);
  if (e1b) throw new Error(`list curriculum journeys: ${e1b.message}`);
  const journeyIds = (linkedJourneys ?? []).map((j) => j.id as string);

  if (journeyIds.length > 0) {
    const { error: e1c } = await supabase
      .from("profiles")
      .update({ active_journey_id: null })
      .in("active_journey_id", journeyIds);
    if (e1c) throw new Error(`null active_journey_id: ${e1c.message}`);
  }

  // 2–4. Capture island/story ids, then delete journeys + orphans
  let islandIds: string[] = [];
  let storyIds: string[] = [];
  if (journeyIds.length > 0) {
    const { data: nodes, error: e2 } = await supabase
      .from("journey_islands")
      .select("island_id, story_id")
      .in("journey_id", journeyIds);
    if (e2) throw new Error(`list journey_islands: ${e2.message}`);
    islandIds = Array.from(
      new Set(
        (nodes ?? [])
          .map((n) => n.island_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    storyIds = Array.from(
      new Set(
        (nodes ?? [])
          .map((n) => n.story_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const { error: e3 } = await supabase
      .from("journeys")
      .delete()
      .not("curriculum_unit_id", "is", null);
    if (e3) throw new Error(`delete journeys: ${e3.message}`);
  }

  if (islandIds.length > 0) {
    const { error: e4 } = await supabase
      .from("topic_islands")
      .delete()
      .in("id", islandIds);
    if (e4) throw new Error(`delete topic_islands: ${e4.message}`);
  }

  if (storyIds.length > 0) {
    const { error: e5 } = await supabase.from("stories").delete().in("id", storyIds);
    if (e5) throw new Error(`delete stories: ${e5.message}`);
  }

  // 5–6. HSK cards
  const { data: hskCards, error: e6 } = await supabase
    .from("cards")
    .select("id")
    .eq("source_type", "hsk_word");
  if (e6) throw new Error(`list hsk cards: ${e6.message}`);
  const cardIds = (hskCards ?? []).map((c) => c.id as string);

  if (cardIds.length > 0) {
    for (let i = 0; i < cardIds.length; i += 200) {
      const chunk = cardIds.slice(i, i + 200);
      const { error } = await supabase
        .from("card_collections")
        .delete()
        .in("card_id", chunk);
      if (error) throw new Error(`delete card_collections: ${error.message}`);
    }
    for (let i = 0; i < cardIds.length; i += 200) {
      const chunk = cardIds.slice(i, i + 200);
      const { error } = await supabase.from("cards").delete().in("id", chunk);
      if (error) throw new Error(`delete cards: ${error.message}`);
    }
  }

  // 7. Curricula (cascades curriculum_units)
  const { error: e7 } = await supabase.from("curricula").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (e7) throw new Error(`delete curricula: ${e7.message}`);

  // 8. Reset HSK answers on all profiles (matches the SQL)
  const { error: e8 } = await supabase
    .from("user_profiles")
    .update({
      hsk_current_level: null,
      hsk_level_source: null,
      hsk_target_level: null,
      test_date: null,
      hsk_motivation: null,
      hsk_personalization_text: null,
      daily_time_minutes: null,
      interests: [],
      active_curriculum_id: null,
    })
    .neq("user_id", "00000000-0000-0000-0000-000000000000");
  if (e8) throw new Error(`reset user_profiles: ${e8.message}`);
}

async function untouchedSanity() {
  const [words, tests, subs] = await Promise.all([
    countEq("hsk_words"),
    countEq("practice_tests"),
    supabase
      .from("product_subscriptions")
      .select("user_id", { count: "exact", head: true })
      .then((r) => {
        if (r.error) throw new Error(r.error.message);
        return r.count ?? 0;
      }),
  ]);
  return { hsk_words: words, practice_tests: tests, product_subscriptions: subs };
}

async function main() {
  const before = await snapshot();
  const untouchedBefore = await untouchedSanity();
  printSnap("BEFORE", before);
  console.log("untouched:", untouchedBefore);

  await runWipe();

  const after = await snapshot();
  const untouchedAfter = await untouchedSanity();
  printSnap("AFTER", after);
  console.log("untouched:", untouchedAfter);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
