import type { SupabaseClient } from "@supabase/supabase-js";
import { HSK_PATH_STANDARD } from "@/lib/hsk/pathStandard";

type SeedWord = {
  id: string;
  hanzi: string;
  pinyin: string;
  english: string | null;
};

/**
 * Inserts hsk_word cards + mastered review state so vocabPool treats the words
 * as already learned. Mirrors lib/hsk/seedCurriculumIsland.ts.
 */
export async function seedKnownHskWords(
  supabase: SupabaseClient,
  {
    userId,
    words,
  }: { userId: string; words: SeedWord[] },
): Promise<{ seeded: number }> {
  if (words.length === 0) return { seeded: 0 };

  const unique = new Map<string, SeedWord>();
  for (const w of words) unique.set(w.id, w);
  const list = Array.from(unique.values());

  const have = new Map<string, string>();
  const { data: existing } = await supabase
    .from("cards")
    .select("id, source_ref_id")
    .eq("user_id", userId)
    .eq("source_type", "hsk_word");
  for (const c of existing ?? []) {
    if (c.source_ref_id) have.set(c.source_ref_id as string, c.id as string);
  }

  const toInsert = list
    .filter((w) => !have.has(w.id))
    .map((w) => ({
      user_id: userId,
      front: w.hanzi,
      back: w.english || w.hanzi,
      front_lang: "zh",
      back_lang: "en",
      pinyin: w.pinyin,
      source_type: "hsk_word",
      source_ref_id: w.id,
    }));

  const newIds: string[] = list
    .map((w) => have.get(w.id))
    .filter((id): id is string => Boolean(id));
  const CHUNK = 150;
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const chunk = toInsert.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from("cards")
      .insert(chunk)
      .select("id");
    if (error) {
      console.warn("[seedKnownHskWords] cards insert", error);
      continue;
    }
    for (const row of data ?? []) newIds.push(row.id as string);
  }

  if (newIds.length === 0) return { seeded: 0 };

  const haveState = new Set<string>();
  for (let i = 0; i < newIds.length; i += CHUNK) {
    const { data: states } = await supabase
      .from("card_review_state")
      .select("card_id")
      .eq("user_id", userId)
      .in("card_id", newIds.slice(i, i + CHUNK));
    for (const s of states ?? []) haveState.add(s.card_id as string);
  }

  const dueAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  const stateRows = newIds
    .filter((id) => !haveState.has(id))
    .map((card_id) => ({
      user_id: userId,
      card_id,
      mastery_tier: "easy",
      state: "review",
      interval_days: 4,
      due_at: dueAt,
      last_reviewed_at: now,
    }));

  for (let i = 0; i < stateRows.length; i += CHUNK) {
    const { error } = await supabase
      .from("card_review_state")
      .insert(stateRows.slice(i, i + CHUNK));
    if (error) {
      console.warn("[seedKnownHskWords] review_state insert", error);
    }
  }

  return { seeded: toInsert.length };
}

/** All official 2.0 words strictly below `level`, plus any extra IDs (tapped known). */
export async function loadWordsToSeedAsKnown(
  supabase: SupabaseClient,
  {
    estimatedLevel,
    extraWordIds,
  }: { estimatedLevel: number; extraWordIds: string[] },
): Promise<SeedWord[]> {
  const below =
    estimatedLevel > 1
      ? await supabase
          .from("hsk_words")
          .select("id, hanzi, pinyin, english")
          .eq("standard", HSK_PATH_STANDARD)
          .eq("is_placeholder", false)
          .lt("level", estimatedLevel)
      : { data: [] as SeedWord[], error: null };

  if (below.error) {
    console.warn("[seedKnownHskWords] below-level fetch", below.error);
  }

  const extras =
    extraWordIds.length > 0
      ? await supabase
          .from("hsk_words")
          .select("id, hanzi, pinyin, english")
          .eq("standard", HSK_PATH_STANDARD)
          .eq("is_placeholder", false)
          .in("id", extraWordIds)
      : { data: [] as SeedWord[], error: null };

  if (extras.error) {
    console.warn("[seedKnownHskWords] extra fetch", extras.error);
  }

  return [
    ...((below.data ?? []) as SeedWord[]),
    ...((extras.data ?? []) as SeedWord[]),
  ];
}
