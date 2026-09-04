import type { SupabaseClient } from "@supabase/supabase-js";

export type CurriculumSeedWord = {
  hanzi: string;
  pinyin: string;
  english: string;
  hsk_word_id: string | null;
  hsk_level: number | null;
};

/**
 * Seed a curriculum-unit island's vocabulary from the plan stored on
 * journey_islands.seed_words: writes island_words rows (HSK words tagged
 * difficulty_tag='hsk', supporting words 'support') and creates hsk_word SRS
 * cards for the HSK ones so vocabulary progress + cross-unit "already learned"
 * exclusion work. Sentence generation is handled separately (generate-batch
 * with wordsPreseeded=true).
 */
export async function seedCurriculumIslandWords(
  supabase: SupabaseClient,
  {
    islandId,
    userId,
    seedWords,
  }: { islandId: string; userId: string; seedWords: CurriculumSeedWord[] },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const rows = seedWords.map((w, idx) => ({
    island_id: islandId,
    user_id: userId,
    hanzi: w.hanzi,
    pinyin: w.pinyin,
    english: w.english || w.hanzi,
    difficulty_tag: w.hsk_word_id ? "hsk" : "support",
    position: idx + 1,
    hsk_level: w.hsk_level,
  }));

  const { error: wordsErr } = await supabase.from("island_words").insert(rows);
  if (wordsErr) {
    return { ok: false, error: wordsErr.message || "Failed to seed island words" };
  }

  // hsk_word cards — one per assigned HSK word, idempotent.
  const hskSeeds = seedWords.filter((w) => w.hsk_word_id);
  if (hskSeeds.length > 0) {
    const ids = hskSeeds.map((w) => w.hsk_word_id as string);
    const { data: existing } = await supabase
      .from("cards")
      .select("source_ref_id")
      .eq("user_id", userId)
      .eq("source_type", "hsk_word")
      .in("source_ref_id", ids);
    const have = new Set((existing ?? []).map((c) => c.source_ref_id as string));

    const cardRows = hskSeeds
      .filter((w) => !have.has(w.hsk_word_id as string))
      .map((w) => ({
        user_id: userId,
        front: w.hanzi,
        back: w.english || w.hanzi,
        front_lang: "zh",
        back_lang: "en",
        pinyin: w.pinyin,
        source_type: "hsk_word",
        source_ref_id: w.hsk_word_id,
      }));
    if (cardRows.length > 0) {
      const { error: cardErr } = await supabase.from("cards").insert(cardRows);
      if (cardErr) {
        console.warn("[seedCurriculumIsland] hsk_word cards insert", cardErr);
      }
    }
  }

  return { ok: true };
}

/**
 * Marks the HSK words an island taught as mastered — called when a
 * curriculum-unit island node is completed. Coarse but matches the product
 * model (finish the island that teaches a word => you've learned it).
 */
export async function markCurriculumIslandWordsLearned(
  supabase: SupabaseClient,
  { userId, hskWordIds }: { userId: string; hskWordIds: string[] },
): Promise<void> {
  if (hskWordIds.length === 0) return;

  const { data: cards } = await supabase
    .from("cards")
    .select("id, source_ref_id")
    .eq("user_id", userId)
    .eq("source_type", "hsk_word")
    .in("source_ref_id", hskWordIds);

  const cardIds = (cards ?? []).map((c) => c.id as string);
  if (cardIds.length === 0) return;

  const { data: states } = await supabase
    .from("card_review_state")
    .select("card_id")
    .eq("user_id", userId)
    .in("card_id", cardIds);
  const haveState = new Set((states ?? []).map((s) => s.card_id as string));

  const dueAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString();

  const toInsert = cardIds
    .filter((id) => !haveState.has(id))
    .map((card_id) => ({
      user_id: userId,
      card_id,
      mastery_tier: "easy",
      state: "review",
      interval_days: 4,
      due_at: dueAt,
      last_reviewed_at: new Date().toISOString(),
    }));
  if (toInsert.length > 0) {
    await supabase.from("card_review_state").insert(toInsert);
  }

  const toUpdate = cardIds.filter((id) => haveState.has(id));
  if (toUpdate.length > 0) {
    await supabase
      .from("card_review_state")
      .update({ mastery_tier: "easy", due_at: dueAt })
      .eq("user_id", userId)
      .in("card_id", toUpdate);
  }
}
