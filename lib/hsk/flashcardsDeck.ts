import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Every HSK-track user gets one lazily-created quiz_islands row that backs
 * their default "HSK Flashcards" deck (shown alongside any other decks they
 * create on /app/hsk-flashcards). Tagged origin='hsk' so it's served by the
 * /api/hsk/flashcard-decks/* tree, not /api/quiz-islands (Islands-only).
 */
export async function getOrCreateHskDeck(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("user_id, hsk_flashcards_quiz_island_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile?.hsk_flashcards_quiz_island_id) {
    return profile.hsk_flashcards_quiz_island_id as string;
  }

  const { data: deck, error: deckErr } = await supabase
    .from("quiz_islands")
    .insert({ user_id: userId, name: "HSK Flashcards", origin: "hsk" })
    .select("id")
    .single();

  if (deckErr || !deck) {
    console.error("[hsk] failed to create flashcards deck", deckErr);
    return null;
  }

  if (profile) {
    await supabase
      .from("user_profiles")
      .update({ hsk_flashcards_quiz_island_id: deck.id })
      .eq("user_id", userId);
  } else {
    await supabase
      .from("user_profiles")
      .insert({ user_id: userId, hsk_flashcards_quiz_island_id: deck.id });
  }

  return deck.id as string;
}
