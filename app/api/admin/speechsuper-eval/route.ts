import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scoreWithSpeechSuper, SpeechSuperError, type SpeechSuperMode } from "@/lib/speechsuper/client";

const ADMIN_EMAILS = new Set([
  "cameronlimhwa@gmail.com",
  "themandarinpath@gmail.com",
  "victsang@telus.net",
]);

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

function isAllowedMode(value: FormDataEntryValue | null): value is SpeechSuperMode {
  return value === "word" || value === "sentence";
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

    if (!user.email || !ADMIN_EMAILS.has(user.email.toLowerCase())) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    const referenceText = form.get("referenceText");
    const mode = form.get("mode");
    const audio = form.get("audio");

    if (
      typeof referenceText !== "string" ||
      !referenceText.trim() ||
      !isAllowedMode(mode) ||
      !(audio instanceof File) ||
      audio.size === 0
    ) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "Audio file is too large" }, { status: 413 });
    }

    const result = await scoreWithSpeechSuper({
      appKey,
      secretKey,
      userId: user.id,
      mode,
      referenceText: referenceText.trim(),
      audio: new Blob([await audio.arrayBuffer()], { type: "audio/wav" }),
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SpeechSuperError) {
      return NextResponse.json(
        { error: error.message, ...(error.raw ? { raw: error.raw } : {}) },
        { status: error.status },
      );
    }
    console.error("Error in POST /api/admin/speechsuper-eval:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
