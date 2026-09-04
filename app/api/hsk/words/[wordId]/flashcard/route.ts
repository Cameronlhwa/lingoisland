import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateHskDeck } from "@/lib/hsk/flashcardsDeck";
import { denyWithoutProductAccess } from "@/lib/product-access";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: { wordId: string } },
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const denial = await denyWithoutProductAccess(user.id, "hsk");
    if (denial) return denial;

    const { data: word, error: wordErr } = await supabase
      .from("hsk_words")
      .select("id, hanzi, pinyin, english")
      .eq("id", params.wordId)
      .maybeSingle();
    if (wordErr || !word) {
      return NextResponse.json({ error: "Word not found" }, { status: 404 });
    }

    const { data: existing } = await supabase
      .from("cards")
      .select("id")
      .eq("user_id", user.id)
      .eq("source_type", "hsk_word")
      .eq("source_ref_id", word.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ alreadyAdded: true, cardId: existing.id });
    }

    const deckId = await getOrCreateHskDeck(supabase, user.id);
    if (!deckId) {
      return NextResponse.json(
        { error: "Failed to prepare flashcards deck" },
        { status: 500 },
      );
    }

    const { data: card, error: cardErr } = await supabase
      .from("cards")
      .insert({
        user_id: user.id,
        front: word.hanzi,
        back: word.english,
        front_lang: "zh",
        back_lang: "en",
        pinyin: word.pinyin,
        source_type: "hsk_word",
        source_ref_id: word.id,
      })
      .select("id")
      .single();

    if (cardErr || !card) {
      console.error("[hsk/words/flashcard] card insert", cardErr);
      return NextResponse.json({ error: "Failed to add flashcard" }, { status: 500 });
    }

    const { error: collErr } = await supabase.from("card_collections").insert({
      user_id: user.id,
      collection_type: "quiz_island",
      collection_id: deckId,
      card_id: card.id,
    });

    if (collErr) {
      console.error("[hsk/words/flashcard] collection insert", collErr);
      return NextResponse.json({ error: "Failed to add flashcard" }, { status: 500 });
    }

    return NextResponse.json({ added: true, cardId: card.id });
  } catch (e) {
    console.error("[hsk/words/flashcard]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
