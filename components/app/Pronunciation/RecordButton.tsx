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

export type ScoreResult = {
  attemptId: string;
  overallScore: number | null;
  characters: CharacterScore[];
  weakSyllables: { syllable: string; pinyin: string | null; targetTone: number | null; score: number | null }[];
};

type UnitType = "word" | "sentence" | "syllable_drill";

const DEFAULT_MAX_SECONDS: Record<UnitType, number> = {
  word: 8,
  sentence: 15,
  syllable_drill: 8,
};

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
}: {
  sessionId: string;
  unitType: UnitType;
  targetText: string;
  targetPinyin?: string;
  islandWordId?: string;
  onRecorded?: (blob: Blob) => void;
  onScored: (result: ScoreResult) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [scoring, setScoring] = useState(false);
  const recorder = useRef<PcmRecorderHandle | null>(null);
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

  const start = async () => {
    if (disabled || recording || scoring) return;
    setSeconds(0);
    try {
      recorder.current = await startPcmRecording();
      setRecording(true);
    } catch (cause) {
      onError?.("Microphone access is needed to practice pronunciation.");
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
      onError?.(cause instanceof Error ? cause.message : "Unable to prepare the recording.");
      return;
    }
    recorder.current = null;
    onRecorded?.(blob);

    setScoring(true);
    try {
      const form = new FormData();
      form.append("sessionId", sessionId);
      form.append("unitType", unitType);
      form.append("targetText", targetText);
      if (targetPinyin) form.append("targetPinyin", targetPinyin);
      if (islandWordId) form.append("islandWordId", islandWordId);
      form.append("clientRequestId", crypto.randomUUID());
      form.append("audio", blob, "recording.wav");

      const response = await fetch("/api/pronunciation/score", { method: "POST", body: form });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(typeof data?.error === "string" ? data.error : "Unable to score recording.");
      }
      onScored({
        attemptId: data.attemptId,
        overallScore: data.overallScore ?? null,
        characters: data.score?.characters ?? [],
        weakSyllables: data.weakSyllables ?? [],
      });
    } catch (cause) {
      onError?.(cause instanceof Error ? cause.message : "Unable to score recording.");
    } finally {
      setScoring(false);
    }
  };

  if (scoring) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-white"
          style={{ background: "var(--lingo-accent-gradient)" }}
        >
          <span className="h-3 w-3 animate-pulse rounded-full bg-white" />
        </div>
        <p className="text-xs font-semibold text-[var(--lingo-text-muted)]">Scoring…</p>
      </div>
    );
  }

  if (recording) {
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => void stopAndSubmit()}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-white shadow-sm transition hover:bg-red-700"
          aria-label="Stop recording"
        >
          <Square size={22} fill="currentColor" />
        </button>
        <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          Recording {seconds}s / {maxSeconds}s
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => void start()}
        disabled={disabled}
        className="flex h-16 w-16 items-center justify-center rounded-full text-white shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50"
        style={{ background: "var(--lingo-accent-gradient)" }}
        aria-label="Tap to record"
      >
        <Mic size={22} />
      </button>
      <p className="text-xs font-semibold text-[var(--lingo-navy)]">Tap to record</p>
    </div>
  );
}
