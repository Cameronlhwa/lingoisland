"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import {
  abortPcmRecording,
  startPcmRecording,
  stopPcmRecording,
  type PcmRecorderHandle,
} from "@/lib/audio/recordPcm";
import type { CharacterScore } from "@/lib/pronunciation/normalizeScore";
import type { IsolateTarget } from "@/lib/pronunciation/isolateTarget";
import { coerceIsolateTargets } from "@/lib/pronunciation/isolateTarget";

export type ScoreResult = {
  attemptId: string;
  overallScore: number | null;
  characters: CharacterScore[];
  weakSyllables: IsolateTarget[];
};

export type RecordErrorKind = "mic" | "silent" | "rate_limit" | "network" | "generic";

export type RecordError = {
  kind: RecordErrorKind;
  message: string;
  /** Last captured blob when scoring failed after a successful record (retry scoring). */
  audioBlob?: Blob;
};

type UnitType = "word" | "sentence" | "syllable_drill";

const DEFAULT_MAX_SECONDS: Record<UnitType, number> = {
  word: 8,
  sentence: 15,
  syllable_drill: 8,
};

function classifyError(message: string, status?: number): RecordErrorKind {
  if (status === 429 || /limit reached/i.test(message)) return "rate_limit";
  if (/microphone|permission|NotAllowed|getUserMedia/i.test(message)) return "mic";
  if (/silent|couldn't hear|no microphone audio/i.test(message)) return "silent";
  if (/fetch|network|Failed to fetch/i.test(message)) return "network";
  return "generic";
}

export default function RecordButton({
  sessionId,
  unitType,
  targetText,
  targetPinyin,
  islandWordId,
  onRecorded,
  onScored,
  onError,
  disabled = false,
  /** When set, re-submit this blob instead of recording again (network retry). */
  retryBlob,
  onRetryConsumed,
}: {
  sessionId: string;
  unitType: UnitType;
  targetText: string;
  targetPinyin?: string;
  islandWordId?: string;
  onRecorded?: (blob: Blob) => void;
  onScored: (result: ScoreResult) => void;
  onError?: (error: RecordError) => void;
  disabled?: boolean;
  retryBlob?: Blob | null;
  onRetryConsumed?: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [scoring, setScoring] = useState(false);
  const recorder = useRef<PcmRecorderHandle | null>(null);
  const lastBlob = useRef<Blob | null>(null);
  const requestIds = useRef(new WeakMap<Blob, string>());
  const maxSeconds = DEFAULT_MAX_SECONDS[unitType];

  useEffect(() => {
    if (!recording) return;
    const interval = window.setInterval(() => setSeconds((v) => v + 1), 1000);
    return () => window.clearInterval(interval);
  }, [recording]);

  useEffect(() => {
    if (recording && seconds >= maxSeconds) void stopAndSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording, seconds, maxSeconds]);

  useEffect(() => () => {
    if (recorder.current) abortPcmRecording(recorder.current);
  }, []);

  useEffect(() => {
    if (retryBlob) {
      void submitBlob(retryBlob).finally(() => onRetryConsumed?.());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryBlob]);

  const submitBlob = async (blob: Blob) => {
    lastBlob.current = blob;
    onRecorded?.(blob);
    setScoring(true);
    try {
      const form = new FormData();
      form.append("sessionId", sessionId);
      form.append("unitType", unitType);
      form.append("targetText", targetText);
      if (targetPinyin) form.append("targetPinyin", targetPinyin);
      if (islandWordId) form.append("islandWordId", islandWordId);
      const requestId = requestIds.current.get(blob) ?? crypto.randomUUID();
      requestIds.current.set(blob, requestId);
      form.append("clientRequestId", requestId);
      form.append("audio", blob, "recording.wav");

      const response = await fetch("/api/pronunciation/score", { method: "POST", body: form });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        const message =
          typeof data?.error === "string" ? data.error : "Unable to score recording.";
        throw Object.assign(new Error(message), { status: response.status });
      }
      onScored({
        attemptId: data.attemptId,
        overallScore: data.overallScore ?? null,
        characters: data.score?.characters ?? [],
        weakSyllables: coerceIsolateTargets(data.weakSyllables),
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to score recording.";
      const status = cause && typeof cause === "object" && "status" in cause ? Number((cause as { status: number }).status) : undefined;
      onError?.({
        kind: classifyError(message, status),
        message,
        audioBlob: lastBlob.current ?? undefined,
      });
    } finally {
      setScoring(false);
    }
  };

  const start = async () => {
    if (disabled || recording || scoring) return;
    setSeconds(0);
    try {
      recorder.current = await startPcmRecording();
      setRecording(true);
    } catch {
      onError?.({
        kind: "mic",
        message: "We need microphone access to hear your pronunciation.",
      });
    }
  };

  const stopAndSubmit = async () => {
    if (!recorder.current) return;
    setRecording(false);
    let blob: Blob;
    try {
      blob = stopPcmRecording(recorder.current);
    } catch (cause) {
      recorder.current = null;
      const message = cause instanceof Error ? cause.message : "Unable to prepare the recording.";
      onError?.({ kind: classifyError(message), message });
      return;
    }
    recorder.current = null;
    await submitBlob(blob);
  };

  if (scoring) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div
          className="relative flex h-20 w-20 items-center justify-center rounded-full text-white"
          style={{ background: "var(--lingo-accent-gradient)" }}
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-sky-300/40" />
          <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-white" />
        </div>
        <p className="text-sm font-semibold text-(--lingo-text-muted)">Checking your pronunciation…</p>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => void stopAndSubmit()}
          className="relative flex h-20 w-20 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-600"
          aria-label="Stop recording"
        >
          <span className="absolute inset-[-6px] animate-ping rounded-full bg-red-400/30" />
          <Square size={26} fill="currentColor" />
        </button>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-red-600">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          Listening… {seconds}s / {maxSeconds}s
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => void start()}
        disabled={disabled}
        className="flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50"
        style={{ background: "var(--lingo-accent-gradient)", boxShadow: "0 12px 28px rgba(33,118,174,.28)" }}
        aria-label="Tap to record"
      >
        <Mic size={28} />
      </button>
      <p className="text-sm font-bold text-(--lingo-navy)">Tap to record</p>
    </div>
  );
}
