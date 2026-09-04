import { createHash, randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAILS = new Set([
  "cameronlimhwa@gmail.com",
  "themandarinpath@gmail.com",
  "victsang@telus.net",
]);

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

type Mode = "word" | "sentence";

function sha1(content: string) {
  return createHash("sha1").update(content).digest("hex");
}

function isAllowedMode(value: FormDataEntryValue | null): value is Mode {
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

    const sampleRate = 16_000;
    const coreType = mode === "word" ? "word.eval.promax.cn" : "sent.eval.cn";
    const timestamp = Date.now().toString();
    const tokenId = randomUUID().replace(/-/g, "").toUpperCase();
    const audioType = "wav";

    const params = {
      connect: {
        cmd: "connect",
        param: {
          sdk: { version: 16777472, source: 9, protocol: 2 },
          app: {
            applicationId: appKey,
            sig: sha1(`${appKey}${timestamp}${secretKey}`),
            timestamp,
          },
        },
      },
      start: {
        cmd: "start",
        param: {
          app: {
            applicationId: appKey,
            sig: sha1(`${appKey}${timestamp}${user.id}${secretKey}`),
            userId: user.id,
            timestamp,
          },
          audio: {
            audioType,
            sampleRate,
            channel: 1,
            sampleBytes: 2,
          },
          request: {
            coreType,
            refText: referenceText.trim().slice(0, mode === "word" ? 64 : 500),
            tokenId,
          },
        },
      },
    };

    const speechSuperForm = new FormData();
    speechSuperForm.append("text", JSON.stringify(params));
    speechSuperForm.append(
      "audio",
      new Blob([await audio.arrayBuffer()], { type: "audio/wav" }),
      "recording.wav",
    );

    const response = await fetch(`https://api.speechsuper.com/${coreType}`, {
      method: "POST",
      headers: { "Request-Index": "0" },
      body: speechSuperForm,
      signal: AbortSignal.timeout(30_000),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error("[speechsuper-eval] API error", response.status, responseText.slice(0, 500));
      return NextResponse.json(
        { error: "SpeechSuper evaluation failed" },
        { status: response.status >= 400 && response.status < 500 ? 502 : 503 },
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error("[speechsuper-eval] Non-JSON response", responseText.slice(0, 500));
      return NextResponse.json({ error: "SpeechSuper returned an invalid response" }, { status: 502 });
    }

    const errId = typeof parsed.errId === "number" ? parsed.errId : 0;
    if (errId !== 0 || typeof parsed.error === "string") {
      const message = typeof parsed.error === "string" ? parsed.error : `SpeechSuper error ${errId}`;
      console.error("[speechsuper-eval] SpeechSuper reported an error", errId, message);
      return NextResponse.json({ error: message, raw: parsed }, { status: 422 });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Error in POST /api/admin/speechsuper-eval:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
