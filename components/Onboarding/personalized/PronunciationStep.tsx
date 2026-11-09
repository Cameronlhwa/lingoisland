"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, RotateCcw, Square, Volume2 } from "lucide-react";
import { abortPcmRecording, startPcmRecording, stopPcmRecording, type PcmRecorderHandle } from "@/lib/audio/recordPcm";
import { ONBOARDING_EVENTS } from "@/lib/onboarding/personalized/analytics";
import { provisionalLevel, topicFamily } from "@/lib/onboarding/personalized/flow";
import {
  pronunciationWords,
  toneSupportFrom,
  type PronunciationResult,
  type PronunciationStatus,
} from "@/lib/onboarding/personalized/pronunciation";
import type { StepProps } from "./stepTypes";
import { CARD_BORDER, GREEN, LiveRegion, MUTED, NAVY, PrimaryButton, SecondaryButton, SKY_PALE, StepFrame, TextButton } from "./ui";

const MAX_RECORDING_MS = 4000;

type Phase = "offer" | "idle" | "recording" | "checking" | "done";

export function PronunciationStep({
  state,
  next,
  back,
  progress,
  track,
  ensureSession,
}: StepProps & { ensureSession: () => Promise<boolean> }) {
  const words = pronunciationWords(topicFamily(state.answers), provisionalLevel(state.answers));
  const [phase, setPhase] = useState<Phase>("offer");
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<PronunciationResult[]>([]);
  const [status, setStatus] = useState("");
  const handleRef = useRef<PcmRecorderHandle | null>(null);
  const timerRef = useRef<number | null>(null);
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const word = words[index];

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (handleRef.current) abortPcmRecording(handleRef.current);
    },
    [],
  );

  const finish = (outcome: PronunciationStatus, collected: PronunciationResult[]) => {
    const toneSupport = toneSupportFrom(collected);
    const event =
      outcome === "skipped"
        ? ONBOARDING_EVENTS.pronunciationSkipped
        : outcome === "denied"
          ? ONBOARDING_EVENTS.pronunciationDenied
          : outcome === "failed"
            ? ONBOARDING_EVENTS.pronunciationFailed
            : ONBOARDING_EVENTS.pronunciationCompleted;
    track(event, outcome === "completed" ? { outcome: toneSupport ?? "standard" } : undefined);
    next({ pronunciation: { status: outcome, toneSupport } });
  };

  const tryIt = async () => {
    track(ONBOARDING_EVENTS.pronunciationAccepted);
    setPhase("idle");
  };

  const hear = () => {
    if (!canSpeak) return;
    const utterance = new SpeechSynthesisUtterance(word.hanzi);
    utterance.lang = "zh-CN";
    utterance.rate = 0.8;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const submit = async (audio: Blob) => {
    setPhase("checking");
    setStatus("Checking your recording");
    try {
      const body = new FormData();
      body.append("targetText", word.hanzi);
      body.append("audio", audio, "word.wav");
      const response = await fetch("/api/onboarding/pronunciation", { method: "POST", body });
      const data = (await response.json().catch(() => null)) as { status?: string; needsToneSupport?: boolean } | null;
      if (!response.ok || data?.status !== "ok") {
        // Scoring unavailable: keep going without blocking the learner.
        finish(results.length > 0 ? "completed" : "failed", results);
        return;
      }
      const collected = [...results, { word: word.hanzi, needsToneSupport: Boolean(data.needsToneSupport) }];
      setResults(collected);
      setPhase("done");
      setStatus("Got it. Thanks!");
    } catch {
      finish(results.length > 0 ? "completed" : "failed", results);
    }
  };

  const stop = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    const handle = handleRef.current;
    handleRef.current = null;
    if (!handle) return;
    let audio: Blob;
    try {
      audio = stopPcmRecording(handle);
    } catch {
      setPhase("idle");
      setStatus("We didn’t hear anything. Try again, or skip for now.");
      return;
    }
    void submit(audio);
  };

  const record = async () => {
    setStatus("");
    // The microphone is requested only now, after the learner chose to try.
    const signedIn = await ensureSession();
    if (!signedIn) {
      finish("failed", results);
      return;
    }
    try {
      handleRef.current = await startPcmRecording();
    } catch (error) {
      const name = (error as { name?: string })?.name;
      finish(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "failed", results);
      return;
    }
    setPhase("recording");
    setStatus(`Recording. Say ${word.hanzi}.`);
    timerRef.current = window.setTimeout(stop, MAX_RECORDING_MS);
  };

  const nextWord = () => {
    if (index + 1 >= words.length) {
      finish("completed", results);
      return;
    }
    setIndex(index + 1);
    setPhase("idle");
    setStatus("");
  };

  const retry = () => {
    setResults(results.slice(0, index));
    setPhase("idle");
    setStatus("");
  };

  if (phase === "offer") {
    return (
      <StepFrame
        title="Want to personalize your speaking practice too?"
        subtitle="Try two quick words, or skip this for now."
        progress={progress}
        onBack={back}
      >
        <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
          We’ll ask for your microphone only if you choose to try. Your recording is used once to tune tone practice and is not saved.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <PrimaryButton onClick={() => void tryIt()} data-testid="pronunciation-try">
            <Mic size={18} aria-hidden />
            Try it
          </PrimaryButton>
          <SecondaryButton onClick={() => finish("skipped", [])} data-testid="pronunciation-skip">
            Skip for now
          </SecondaryButton>
        </div>
      </StepFrame>
    );
  }

  return (
    <StepFrame
      title={`Say this word (${index + 1} of ${words.length})`}
      subtitle="Tap record, say the word once, and we’ll handle the rest."
      progress={progress}
      onBack={null}
    >
      <LiveRegion message={status} />
      <div className="rounded-2xl px-4 py-6 text-center" style={{ background: SKY_PALE, border: `1px solid ${CARD_BORDER}` }}>
        <p lang="zh-Hans" className="text-[44px] font-semibold leading-none" style={{ color: NAVY }}>
          {word.hanzi}
        </p>
        <p lang="zh-Latn-pinyin" className="mt-2 text-lg" style={{ color: GREEN }}>
          {word.pinyin}
        </p>
        <p className="mt-1 text-sm" style={{ color: MUTED }}>
          {word.english}
        </p>
        {canSpeak ? (
          <button
            type="button"
            onClick={hear}
            className="mx-auto mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 text-sm font-semibold hover:bg-white"
            style={{ color: NAVY }}
          >
            <Volume2 size={18} aria-hidden />
            Hear it
          </button>
        ) : null}
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        {phase === "recording" ? (
          <button
            type="button"
            onClick={stop}
            className="inline-flex min-h-[56px] items-center gap-2 rounded-full px-6 text-[15px] font-semibold text-white"
            style={{ background: NAVY }}
            data-testid="pronunciation-stop"
          >
            <Square size={16} fill="currentColor" aria-hidden />
            Stop recording
          </button>
        ) : phase === "checking" ? (
          <p className="text-sm font-semibold" style={{ color: MUTED }}>
            Checking…
          </p>
        ) : phase === "done" ? (
          <>
            <p className="text-[15px] font-semibold" style={{ color: GREEN }}>
              Got it. Thanks!
            </p>
            <div className="grid w-full gap-3 sm:grid-cols-2">
              <PrimaryButton onClick={nextWord} data-testid="pronunciation-next">
                {index + 1 >= words.length ? "Continue" : "Next word"}
              </PrimaryButton>
              <SecondaryButton onClick={retry}>
                <RotateCcw size={16} aria-hidden />
                Try again
              </SecondaryButton>
            </div>
          </>
        ) : (
          <PrimaryButton onClick={() => void record()} aria-label={`Record yourself saying ${word.hanzi}`} data-testid="pronunciation-record">
            <Mic size={18} aria-hidden />
            Record
          </PrimaryButton>
        )}
        {phase === "recording" ? (
          <p className="flex items-center gap-2 text-sm" style={{ color: MUTED }}>
            <span aria-hidden className="h-2.5 w-2.5 rounded-full motion-safe:animate-pulse" style={{ background: GREEN }} />
            Listening…
          </p>
        ) : null}
        {phase !== "recording" && phase !== "checking" ? (
          <TextButton onClick={() => finish(results.length > 0 ? "completed" : "skipped", results)}>Skip for now</TextButton>
        ) : null}
      </div>
    </StepFrame>
  );
}
