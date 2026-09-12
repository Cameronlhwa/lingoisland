import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scoreWithSpeechSuper, SpeechSuperError, type SpeechSuperMode } from "@/lib/speechsuper/client";
import { normalizeSpeechSuperResult, type CharacterScore } from "@/lib/pronunciation/normalizeScore";
import { checkAndIncrementUsage } from "@/lib/pronunciation/rateLimit";

export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const WEAK_SYLLABLE_THRESHOLD = 80;

type UnitType = "word" | "sentence" | "syllable_drill";

function isAllowedUnitType(value: FormDataEntryValue | null): value is UnitType {
  return value === "word" || value === "sentence" || value === "syllable_drill";
}

function speechSuperModeFor(unitType: UnitType): SpeechSuperMode {
  return unitType === "sentence" ? "sentence" : "word";
}

function weakSyllablesFrom(characters: CharacterScore[]) {
  return characters
    .filter((character) => character.score !== null && character.score < WEAK_SYLLABLE_THRESHOLD)
    .map((character) => ({
      syllable: character.hanzi,
      pinyin: character.pinyin,
      targetTone: character.targetTone,
      score: character.score,
    }));
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appKey = process.env.SPEECHSUPER_APP_KEY;
    const secretKey = process.env.SPEECHSUPER_SECRET_KEY;
    if (!appKey || !secretKey) {
      return NextResponse.json(
        { error: "SpeechSuper credentials are not configured" },
        { status: 500 },
      );
    }

    const form = await request.formData();
    const sessionId = form.get("sessionId");
    const unitType = form.get("unitType");
    const targetText = form.get("targetText");
    const targetPinyin = form.get("targetPinyin");
    const islandWordId = form.get("islandWordId");
    const clientRequestId = form.get("clientRequestId");
    const audio = form.get("audio");

    if (
      typeof sessionId !== "string" ||
      !sessionId ||
      !isAllowedUnitType(unitType) ||
      typeof targetText !== "string" ||
      !targetText.trim() ||
      typeof clientRequestId !== "string" ||
      !clientRequestId ||
      !(audio instanceof File) ||
      audio.size === 0
    ) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Audio file is too large" }, { status: 413 });
    }

    // The session must belong to the caller — RLS also enforces this, but
    // checking explicitly lets us return a clean 404 instead of a confusing
    // empty insert failure.
    const { data: session, error: sessionError } = await supabase
      .from("pronunciation_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Practice session not found" }, { status: 404 });
    }

    // Idempotency: a duplicate submit (double-tap, two tabs) with the same
    // clientRequestId returns the already-scored attempt instead of paying
    // for a second SpeechSuper call.
    const { data: existingAttempt } = await supabase
      .from("pronunciation_attempts")
      .select("id, score, overall_score, weak_syllables")
      .eq("session_id", sessionId)
      .eq("target_text", targetText)
      .eq("client_request_id", clientRequestId)
      .maybeSingle();

    if (existingAttempt) {
      return NextResponse.json({
        attemptId: existingAttempt.id,
        score: existingAttempt.score,
        overallScore: existingAttempt.overall_score,
        weakSyllables: existingAttempt.weak_syllables,
      });
    }

    const usage = await checkAndIncrementUsage(supabase, user.id);
    if (!usage.ok) {
      return NextResponse.json(
        { error: "Daily pronunciation practice limit reached. Try again tomorrow." },
        { status: 429 },
      );
    }

    const raw = await scoreWithSpeechSuper({
      appKey,
      secretKey,
      userId: user.id,
      mode: speechSuperModeFor(unitType),
      referenceText: targetText.trim(),
      audio: new Blob([await audio.arrayBuffer()], { type: "audio/wav" }),
    });

    const normalized = normalizeSpeechSuperResult(raw);
    const weakSyllables = weakSyllablesFrom(normalized.characters);

    const { count: attemptCount } = await supabase
      .from("pronunciation_attempts")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("target_text", targetText);

    const { data: inserted, error: insertError } = await supabase
      .from("pronunciation_attempts")
      .insert({
        user_id: user.id,
        session_id: sessionId,
        unit_type: unitType,
        target_text: targetText,
        target_pinyin: typeof targetPinyin === "string" ? targetPinyin : null,
        island_word_id: typeof islandWordId === "string" && islandWordId ? islandWordId : null,
        attempt_number: (attemptCount ?? 0) + 1,
        score: normalized,
        overall_score: normalized.overall,
        weak_syllables: weakSyllables,
        client_request_id: clientRequestId,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      // Most likely a concurrent duplicate raced us past the client_request_id
      // uniqueness check above — fall back to whatever they inserted.
      const { data: raced } = await supabase
        .from("pronunciation_attempts")
        .select("id, score, overall_score, weak_syllables")
        .eq("session_id", sessionId)
        .eq("target_text", targetText)
        .eq("client_request_id", clientRequestId)
        .maybeSingle();

      if (raced) {
        return NextResponse.json({
          attemptId: raced.id,
          score: raced.score,
          overallScore: raced.overall_score,
          weakSyllables: raced.weak_syllables,
        });
      }

      console.error("[pronunciation/score] failed to record attempt", insertError);
      return NextResponse.json({ error: "Failed to record attempt" }, { status: 500 });
    }

    return NextResponse.json({
      attemptId: inserted.id,
      score: normalized,
      overallScore: normalized.overall,
      weakSyllables,
    });
  } catch (error) {
    if (error instanceof SpeechSuperError) {
      // Never forward SpeechSuper's raw response/error codes to the client.
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error in POST /api/pronunciation/score:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
