"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import SpeakerButton from "@/components/app/SpeakerButton";
import SpeakerWithSpeed from "@/components/app/SpeakerWithSpeed";
import RecordButton, { type ScoreResult } from "@/components/app/Pronunciation/RecordButton";
import TonePracticeFeedbackCard from "@/components/app/Pronunciation/TonePracticeFeedbackCard";
import type { DrillItem } from "@/lib/deepseek/generate-pronunciation-drill";

type Phase = "word-before" | "word-feedback" | "sentence-before" | "sentence-feedback" | "isolate-before" | "isolate-feedback";

export default function PronunciationSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<DrillItem[]>([]);
  const [itemIndex, setItemIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("word-before");
  const [hidden, setHidden] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const [wordResult, setWordResult] = useState<ScoreResult | null>(null);
  const [sentenceResult, setSentenceResult] = useState<ScoreResult | null>(null);
  const [isolateSyllable, setIsolateSyllable] = useState<{ hanzi: string; pinyin: string | null; targetTone: number | null } | null>(null);
  const [isolateResult, setIsolateResult] = useState<ScoreResult | null>(null);

  const recordedUrl = useRef<string | null>(null);
  const [recordedUrlState, setRecordedUrlState] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    void (async () => {
      const res = await fetch(`/api/pronunciation/session/${sessionId}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setLoadError("Couldn't load this practice session.");
        setLoading(false);
        return;
      }
      setItems(data.session?.sentences ?? []);
      setLoading(false);
    })();
  }, [sessionId]);

  useEffect(() => () => {
    if (recordedUrl.current) URL.revokeObjectURL(recordedUrl.current);
  }, []);

  const handleRecorded = (blob: Blob) => {
    if (recordedUrl.current) URL.revokeObjectURL(recordedUrl.current);
    recordedUrl.current = URL.createObjectURL(blob);
    setRecordedUrlState(recordedUrl.current);
  };

  const current = items[itemIndex];

  const goToNextItem = async () => {
    setWordResult(null);
    setSentenceResult(null);
    setIsolateResult(null);
    setIsolateSyllable(null);
    if (itemIndex + 1 < items.length) {
      setItemIndex((i) => i + 1);
      setPhase("word-before");
    } else {
      setFinishing(true);
      await fetch(`/api/pronunciation/session/${sessionId}/complete`, { method: "POST" }).catch(() => {});
      router.push("/app/pronunciation");
    }
  };

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-gray-400">Loading…</div>;
  }

  if (loadError || !current) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-gray-500">{loadError ?? "This practice session is empty."}</p>
        <button
          type="button"
          onClick={() => router.push("/app/pronunciation")}
          className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-black text-white"
        >
          Back to Pronunciation
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 md:px-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--lingo-text-muted)]">
          {itemIndex + 1} of {items.length}
        </p>
        <div className="h-1.5 flex-1 max-w-[160px] overflow-hidden rounded-full bg-[var(--lingo-sky-pale)]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round(((itemIndex + (phase.startsWith("sentence") || phase.startsWith("isolate") ? 0.5 : 0)) / items.length) * 100)}%`,
              background: "var(--lingo-accent-gradient)",
            }}
          />
        </div>
      </div>

      <div
        className="rounded-[28px] border border-[var(--lingo-accent-border)] bg-white p-6 shadow-sm sm:p-8"
        style={{ boxShadow: "var(--lingo-shadow-card)" }}
      >
        {phase === "word-before" && (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--lingo-blue)]">Say the word</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="lingo-display text-4xl font-bold text-[var(--lingo-navy)]">{current.wordHanzi}</span>
              <SpeakerWithSpeed text={current.wordHanzi} type="word" size="md" />
            </div>
            {!hidden && (
              <p className="mt-2 text-center text-sm text-[var(--lingo-text-muted)]">
                {current.wordPinyin} · {current.wordEnglish}
              </p>
            )}
            <button
              type="button"
              onClick={() => setHidden((h) => !h)}
              className="mx-auto mt-3 flex items-center gap-1.5 text-xs font-bold text-[var(--lingo-text-muted)]"
            >
              {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
              {hidden ? "Show pinyin & translation" : "Hide pinyin & translation"}
            </button>
            <div className="mt-6 flex justify-center">
              <RecordButton
                sessionId={sessionId}
                unitType="word"
                targetText={current.wordHanzi}
                targetPinyin={current.wordPinyin}
                onRecorded={handleRecorded}
                onScored={(result) => {
                  setWordResult(result);
                  setPhase("word-feedback");
                }}
                onError={setError}
              />
            </div>
          </>
        )}

        {phase === "word-feedback" && wordResult && (
          <TonePracticeFeedbackCard
            result={wordResult}
            recordedAudioUrl={recordedUrlState}
            onRetry={() => setPhase("word-before")}
            onContinue={() => setPhase("sentence-before")}
            continueLabel="Continue to sentence →"
          />
        )}

        {phase === "sentence-before" && (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--lingo-blue)]">Say the sentence</p>
            <div className="mt-3 flex flex-wrap items-end justify-center gap-x-1 gap-y-2 rounded-2xl bg-[var(--lingo-sky-pale)] px-4 py-4">
              {Array.from(current.sentenceHanzi).map((char, index) => (
                <SpeakerButton key={index} text={char} type="word" size="sm" className="!inline-flex" />
              ))}
            </div>
            <p className="mt-3 text-center text-2xl font-semibold text-[var(--lingo-navy)]">{current.sentenceHanzi}</p>
            {!hidden && (
              <p className="mt-1 text-center text-sm text-[var(--lingo-text-muted)]">
                {current.sentencePinyin} · {current.sentenceEnglish}
              </p>
            )}
            <div className="mt-3 flex items-center justify-center gap-3">
              <SpeakerWithSpeed text={current.sentenceHanzi} type="sentence" size="md" />
              <button
                type="button"
                onClick={() => setHidden((h) => !h)}
                className="flex items-center gap-1.5 text-xs font-bold text-[var(--lingo-text-muted)]"
              >
                {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                {hidden ? "Show" : "Hide"}
              </button>
            </div>
            <div className="mt-6 flex justify-center">
              <RecordButton
                sessionId={sessionId}
                unitType="sentence"
                targetText={current.sentenceHanzi}
                targetPinyin={current.sentencePinyin}
                onRecorded={handleRecorded}
                onScored={(result) => {
                  setSentenceResult(result);
                  setPhase("sentence-feedback");
                }}
                onError={setError}
              />
            </div>
          </>
        )}

        {phase === "sentence-feedback" && sentenceResult && (
          <TonePracticeFeedbackCard
            result={sentenceResult}
            recordedAudioUrl={recordedUrlState}
            onRetry={() => setPhase("sentence-before")}
            onIsolateSyllable={(syllable) => {
              setIsolateSyllable(syllable);
              setPhase("isolate-before");
            }}
            onContinue={() => void goToNextItem()}
            continueLabel={itemIndex + 1 < items.length ? "Next sentence →" : "Finish practice →"}
          />
        )}

        {phase === "isolate-before" && isolateSyllable && (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--lingo-blue)]">Just this sound</p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <span className="lingo-display text-4xl font-bold text-[var(--lingo-navy)]">{isolateSyllable.hanzi}</span>
              <SpeakerButton text={isolateSyllable.hanzi} type="word" size="md" />
            </div>
            {isolateSyllable.pinyin && (
              <p className="mt-2 text-center text-sm text-[var(--lingo-text-muted)]">{isolateSyllable.pinyin}</p>
            )}
            <div className="mt-6 flex justify-center">
              <RecordButton
                sessionId={sessionId}
                unitType="syllable_drill"
                targetText={isolateSyllable.hanzi}
                targetPinyin={isolateSyllable.pinyin ?? undefined}
                onRecorded={handleRecorded}
                onScored={(result) => {
                  setIsolateResult(result);
                  setPhase("isolate-feedback");
                }}
                onError={setError}
              />
            </div>
            <button
              type="button"
              onClick={() => setPhase("sentence-before")}
              className="mx-auto mt-4 block text-xs font-bold text-[var(--lingo-blue)]"
            >
              Try the whole sentence again
            </button>
          </>
        )}

        {phase === "isolate-feedback" && isolateResult && (
          <TonePracticeFeedbackCard
            result={isolateResult}
            recordedAudioUrl={recordedUrlState}
            onRetry={() => setPhase("isolate-before")}
            onContinue={() => setPhase("sentence-before")}
            continueLabel="Back to the sentence →"
          />
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>

      {finishing && <p className="mt-4 text-center text-xs text-[var(--lingo-text-muted)]">Saving your progress…</p>}
    </div>
  );
}
