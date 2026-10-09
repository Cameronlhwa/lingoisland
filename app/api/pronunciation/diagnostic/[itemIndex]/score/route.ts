import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scoreWithSpeechSuper, SpeechSuperError } from "@/lib/speechsuper/client";
import { normalizeSpeechSuperResult } from "@/lib/pronunciation/normalizeScore";
import { checkAndIncrementUsage } from "@/lib/pronunciation/rateLimit";
import { diagnosticItemAt } from "@/lib/pronunciation/diagnosticBank";
import { recordCharacterAttempts } from "@/lib/pronunciation/weakSoundsStore";

export const dynamic = "force-dynamic";

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const SILENT_SCORE_THRESHOLD = 15;

export async function POST(request: Request, props: { params: Promise<{ itemIndex: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const itemIndex = Number(params.itemIndex);
    const item = diagnosticItemAt(itemIndex);
    if (!item || !Number.isInteger(itemIndex)) {
      return NextResponse.json({ error: "Invalid item index" }, { status: 400 });
    }

    const form = await request.formData();
    const passLabelRaw = form.get("passLabel");
    const passLabel = passLabelRaw === "remeasure" ? "remeasure" : "day1";
    const clientRequestId = form.get("clientRequestId");
    const audio = form.get("audio");
    const skip = form.get("skip") === "true";

    if (skip) {
      const { error } = await supabase.from("pronunciation_diagnostic_attempts").upsert(
        {
          user_id: user.id,
          pass_label: passLabel,
          item_index: itemIndex,
          reference_text: item.hanzi,
          target_tags: item.tags,
          audio_path: null,
          score: { skipped: true },
          overall_score: null,
        },
        { onConflict: "user_id,pass_label,item_index" },
      );
      if (error) {
        console.error("[diagnostic/score] skip upsert failed", error);
        return NextResponse.json({ error: "Failed to skip item" }, { status: 500 });
      }
      return NextResponse.json({ skipped: true, itemIndex, overallScore: null });
    }

    if (
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

    const { data: existingDiag } = await supabase
      .from("pronunciation_diagnostic_attempts")
      .select("score, overall_score, audio_path")
      .eq("user_id", user.id)
      .eq("pass_label", passLabel)
      .eq("item_index", itemIndex)
      .maybeSingle();
    const existingScore = existingDiag?.score && typeof existingDiag.score === "object"
      ? (existingDiag.score as Record<string, unknown>)
      : null;
    if (existingScore?.clientRequestId === clientRequestId && existingDiag?.overall_score != null) {
      return NextResponse.json({
        itemIndex,
        overallScore: existingDiag.overall_score,
        audioPath: existingDiag.audio_path,
        clientRequestId,
      });
    }

    const appKey = process.env.SPEECHSUPER_APP_KEY;
    const secretKey = process.env.SPEECHSUPER_SECRET_KEY;
    if (!appKey || !secretKey) {
      return NextResponse.json({ error: "SpeechSuper credentials are not configured" }, { status: 500 });
    }

    const usage = await checkAndIncrementUsage(supabase, user.id);
    if (!usage.ok) {
      return NextResponse.json(
        { error: "Daily pronunciation practice limit reached. Try again tomorrow." },
        { status: 429 },
      );
    }

    const bytes = await audio.arrayBuffer();
    const path = `${user.id}/diagnostic/${passLabel}/${itemIndex}.wav`;
    const { error: uploadError } = await supabase.storage
      .from("pronunciation-recordings")
      .upload(path, bytes, { contentType: "audio/wav", upsert: true });

    if (uploadError) {
      console.error("[diagnostic/score] upload failed", uploadError);
      return NextResponse.json({ error: "Failed to save recording" }, { status: 500 });
    }

    const raw = await scoreWithSpeechSuper({
      appKey,
      secretKey,
      userId: user.id,
      mode: "sentence",
      referenceText: item.hanzi,
      audio: new Blob([bytes], { type: "audio/wav" }),
    });

    const normalized = normalizeSpeechSuperResult(raw);
    const overall = normalized.overall;
    const likelySilent = overall === null || overall < SILENT_SCORE_THRESHOLD;

    if (likelySilent) {
      return NextResponse.json(
        {
          error: "We couldn't hear you clearly. Try speaking a little closer to your microphone.",
          code: "silent",
          overallScore: overall,
        },
        { status: 422 },
      );
    }

    const { error: upsertError } = await supabase.from("pronunciation_diagnostic_attempts").upsert(
      {
        user_id: user.id,
        pass_label: passLabel,
        item_index: itemIndex,
        reference_text: item.hanzi,
        target_tags: item.tags,
        audio_path: path,
        score: { ...normalized, clientRequestId },
        overall_score: overall,
      },
      { onConflict: "user_id,pass_label,item_index" },
    );

    if (upsertError) {
      console.error("[diagnostic/score] upsert failed", upsertError);
      return NextResponse.json({ error: "Failed to save diagnostic attempt" }, { status: 500 });
    }

    try {
      if (existingDiag?.overall_score == null) {
        await recordCharacterAttempts(supabase, user.id, normalized.characters, {
          hanzi: item.hanzi,
          pinyin: item.pinyin,
          english: item.english,
        });
      }
    } catch (err) {
      console.warn("[diagnostic/score] weak-sound tracking failed", err);
    }

    return NextResponse.json({
      itemIndex,
      overallScore: overall,
      audioPath: path,
      clientRequestId,
    });
  } catch (error) {
    if (error instanceof SpeechSuperError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[diagnostic/score]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
