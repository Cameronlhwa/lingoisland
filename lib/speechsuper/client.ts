import { createHash, randomUUID } from "crypto";

export type SpeechSuperMode = "word" | "sentence";

export type SpeechSuperResult = Record<string, unknown>;

export class SpeechSuperError extends Error {
  status: number;
  raw?: unknown;

  constructor(status: number, message: string, raw?: unknown) {
    super(message);
    this.name = "SpeechSuperError";
    this.status = status;
    this.raw = raw;
  }
}

function sha1(content: string) {
  return createHash("sha1").update(content).digest("hex");
}

function coreTypeForMode(mode: SpeechSuperMode) {
  return mode === "word" ? "word.eval.promax.cn" : "sent.eval.cn";
}

function buildSpeechSuperParams({
  appKey,
  secretKey,
  userId,
  mode,
  referenceText,
}: {
  appKey: string;
  secretKey: string;
  userId: string;
  mode: SpeechSuperMode;
  referenceText: string;
}) {
  const timestamp = Date.now().toString();
  const tokenId = randomUUID().replace(/-/g, "").toUpperCase();
  const coreType = coreTypeForMode(mode);

  return {
    coreType,
    params: {
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
            sig: sha1(`${appKey}${timestamp}${userId}${secretKey}`),
            userId,
            timestamp,
          },
          audio: {
            audioType: "wav",
            sampleRate: 16_000,
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
    },
  };
}

/**
 * Scores a WAV recording against a reference Hanzi string via SpeechSuper.
 * Shared by the admin tone-test tool and the production /api/pronunciation
 * routes so the request-signing/response-parsing logic lives in one place.
 */
export async function scoreWithSpeechSuper({
  appKey,
  secretKey,
  userId,
  mode,
  referenceText,
  audio,
}: {
  appKey: string;
  secretKey: string;
  userId: string;
  mode: SpeechSuperMode;
  referenceText: string;
  audio: Blob;
}): Promise<SpeechSuperResult> {
  const { coreType, params } = buildSpeechSuperParams({
    appKey,
    secretKey,
    userId,
    mode,
    referenceText,
  });

  const form = new FormData();
  form.append("text", JSON.stringify(params));
  form.append("audio", audio, "recording.wav");

  const response = await fetch(`https://api.speechsuper.com/${coreType}`, {
    method: "POST",
    headers: { "Request-Index": "0" },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });

  const responseText = await response.text();
  if (!response.ok) {
    console.error("[speechsuper] API error", response.status, responseText.slice(0, 500));
    throw new SpeechSuperError(
      response.status >= 400 && response.status < 500 ? 502 : 503,
      "SpeechSuper evaluation failed",
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    console.error("[speechsuper] Non-JSON response", responseText.slice(0, 500));
    throw new SpeechSuperError(502, "SpeechSuper returned an invalid response");
  }

  const errId = typeof parsed.errId === "number" ? parsed.errId : 0;
  if (errId !== 0 || typeof parsed.error === "string") {
    const message = typeof parsed.error === "string" ? parsed.error : `SpeechSuper error ${errId}`;
    console.error("[speechsuper] SpeechSuper reported an error", errId, message);
    throw new SpeechSuperError(422, message, parsed);
  }

  return parsed;
}
