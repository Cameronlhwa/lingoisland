"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Lightbulb } from "lucide-react";
import SpeakerButton from "@/components/app/SpeakerButton";
import SpeakerWithSpeed from "@/components/app/SpeakerWithSpeed";
import RecordButton, {
  type RecordError,
  type ScoreResult,
} from "@/components/app/Pronunciation/RecordButton";
import PronunciationFeedback from "@/components/app/Pronunciation/PronunciationFeedback";
import type { DrillItem } from "@/lib/deepseek/generate-pronunciation-drill";
import { withSurfaceDrillPinyin } from "@/lib/pronunciation/surfacePinyin";
import { toneGlyph, toneShapeTip } from "@/lib/pronunciation/encouragement";
import { primaryGuide } from "@/lib/pronunciation/soundGuides";
import { coerceIsolateTarget, isolateForForced, type IsolateTarget } from "@/lib/pronunciation/isolateTarget";
import AppPageLoading from "@/components/app/AppPageLoading";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCharacterSet } from "@/contexts/CharacterSetContext";

type Phase =
  | "sound-tip"
  | "word-before"
  | "word-feedback"
  | "sentence-before"
  | "sentence-feedback"
  | "isolate-before"
  | "isolate-feedback"
  | "complete";

type AttemptRow = {
  unit_type: string;
  target_text: string;
  overall_score: number | null;
};

function startingPhaseFor(item: DrillItem | undefined): Phase {
  return item?.focusSyllable ? "sound-tip" : "word-before";
}

function stageLabel(phase: Phase, t: (key: string) => string): string {
  if (phase.startsWith("word")) return t("WORD");
  if (phase.startsWith("sentence")) return t("SENTENCE");
  if (phase.startsWith("isolate") || phase === "sound-tip") return t("FIX A SOUND");
  return "";
}

function resumeFromAttempts(items: DrillItem[], attempts: AttemptRow[]) {
  const sentenceDone = new Set(
    attempts.filter((a) => a.unit_type === "sentence").map((a) => a.target_text),
  );
  let idx = 0;
  while (idx < items.length && sentenceDone.has(items[idx].sentenceHanzi)) idx += 1;
  if (idx >= items.length) {
    return { itemIndex: Math.max(0, items.length - 1), phase: "complete" as Phase, done: true };
  }
  const item = items[idx];
  const wordDone = attempts.some((a) => a.unit_type === "word" && a.target_text === item.wordHanzi);
  if (!wordDone) return { itemIndex: idx, phase: startingPhaseFor(item), done: false };
  return { itemIndex: idx, phase: "sentence-before" as Phase, done: false };
}

export default function PronunciationSessionPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLanguage();
  const { convertText } = useCharacterSet();
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const sessionId = params?.id as string;
  const journeyId = searchParams.get("journeyId");
  const journeyNodeId = searchParams.get("journeyNodeId");
  const appBase = pathname.startsWith("/hsk/app") ? "/hsk/app" : "/app";

  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string | null>(null);
  const [items, setItems] = useState<DrillItem[]>([]);
  const [itemIndex, setItemIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("word-before");
  const [hidden, setHidden] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<RecordError | null>(null);
  const [retryBlob, setRetryBlob] = useState<Blob | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<{
    avgScore: number | null;
    sentenceCount: number;
    topWeak: string | null;
  } | null>(null);

  const [wordResult, setWordResult] = useState<ScoreResult | null>(null);
  const [sentenceResult, setSentenceResult] = useState<ScoreResult | null>(null);
  const [isolateSyllable, setIsolateSyllable] = useState<IsolateTarget | null>(null);
  const [isolateResult, setIsolateResult] = useState<ScoreResult | null>(null);

  const recordedUrl = useRef<string | null>(null);
  const [recordedUrlState, setRecordedUrlState] = useState<string | null>(null);
  const scoresRef = useRef<number[]>([]);

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
      const rawItems = (data.session?.sentences ?? []) as DrillItem[];
      const resolvedItems = rawItems.map(withSurfaceDrillPinyin);
      const attempts = (data.attempts ?? []) as AttemptRow[];
      const resume = resumeFromAttempts(resolvedItems, attempts);
      setItems(resolvedItems);
      setItemIndex(resume.itemIndex);
      setPhase(resume.phase);
      setSource(typeof data.session?.source === "string" ? data.session.source : null);
      scoresRef.current = attempts
        .map((a) => a.overall_score)
        .filter((s): s is number => typeof s === "number");
      if (resume.done) {
        const avg =
          scoresRef.current.length > 0
            ? scoresRef.current.reduce((a, b) => a + b, 0) / scoresRef.current.length
            : null;
        setSessionSummary({
          avgScore: avg,
          sentenceCount: resolvedItems.length,
          topWeak: null,
        });
      }
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
    setRecordError(null);
  };

  const handleScoreError = (err: RecordError) => {
    setRecordError(err);
  };

  const trackScore = (result: ScoreResult) => {
    if (typeof result.overallScore === "number") scoresRef.current.push(result.overallScore);
  };

  const current = items[itemIndex];
  const isolateTarget = isolateSyllable
    ? sentenceResult
      ? isolateForForced(sentenceResult.characters, isolateSyllable)
      : coerceIsolateTarget(isolateSyllable)
    : null;

  const progressPct = useMemo(() => {
    if (!items.length) return 0;
    const stageBoost =
      phase.startsWith("sentence") || phase.startsWith("isolate") || phase === "complete" ? 0.55 : 0.15;
    return Math.min(100, Math.round(((itemIndex + stageBoost) / items.length) * 100));
  }, [items.length, itemIndex, phase]);

  const finishSession = async () => {
    setFinishing(true);
    const scores = scoresRef.current;
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const lastWeak =
      sentenceResult?.weakSyllables[0]?.syllable ??
      wordResult?.weakSyllables[0]?.syllable ??
      null;
    setSessionSummary({
      avgScore: avg,
      sentenceCount: items.length,
      topWeak: lastWeak,
    });
    setPhase("complete");
    await fetch(`/api/pronunciation/session/${sessionId}/complete`, { method: "POST" }).catch(() => {});
    if (journeyId && journeyNodeId) {
      await fetch(`/api/journey/${journeyId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyIslandId: journeyNodeId }),
      }).catch(() => {});
    }
    setFinishing(false);
  };

  const goToNextItem = async () => {
    setWordResult(null);
    setSentenceResult(null);
    setIsolateResult(null);
    setIsolateSyllable(null);
    setRecordError(null);
    if (itemIndex + 1 < items.length) {
      setItemIndex((i) => i + 1);
      setPhase(startingPhaseFor(items[itemIndex + 1]));
    } else {
      await finishSession();
    }
  };

  const leave = () => {
    if (journeyId) router.push(`${appBase}/journey/${journeyId}`);
    else router.push("/app/pronunciation");
  };

  if (loading) {
    return <AppPageLoading />;
  }

  if (loadError || (!current && phase !== "complete")) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-[var(--lingo-text-muted)]">{loadError ?? convertText(t("This practice session is empty."))}</p>
        <button
          type="button"
          onClick={() => router.push("/app/pronunciation")}
          className="rounded-xl bg-[var(--lingo-navy)] px-5 py-2.5 text-sm font-bold text-white"
        >
          {convertText(t("Back to Pronunciation"))}
        </button>
      </div>
    );
  }

  if (phase === "complete" && sessionSummary) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 py-10 text-center">
        <div className="relative mb-4 h-40 w-40 overflow-hidden rounded-3xl">
          <Image src="/pronunciation/huahua-celebrating.png" alt="" fill className="object-cover" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-blue)]">{convertText(t("Session complete"))}</p>
        <h1 className="lingo-display mt-2 text-3xl font-bold text-[var(--lingo-navy)]">{convertText(t("Practice complete!"))}</h1>
        <div className="mt-6 flex gap-6">
          <div>
            <p className="lingo-display text-4xl font-bold text-[var(--lingo-navy)]">
              {sessionSummary.avgScore == null ? "—" : Math.round(sessionSummary.avgScore)}
            </p>
            <p className="text-xs font-semibold text-[var(--lingo-text-muted)]">{convertText(t("Today's score"))}</p>
          </div>
          <div>
            <p className="lingo-display text-4xl font-bold text-[var(--lingo-navy)]">{sessionSummary.sentenceCount}</p>
            <p className="text-xs font-semibold text-[var(--lingo-text-muted)]">{convertText(t("sentences"))}</p>
          </div>
        </div>
        {sessionSummary.topWeak && (
          <p className="mt-5 max-w-sm text-sm text-[var(--lingo-text)]">
            Keep working on <span className="font-bold">{sessionSummary.topWeak}</span> — we&apos;ll weave it into future practice.
          </p>
        )}
        <div className="mt-8 flex w-full max-w-sm flex-col gap-2">
          <button
            type="button"
            onClick={leave}
            className="w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-white"
            style={{ background: "var(--lingo-accent-gradient)" }}
          >
            {convertText(t("Done"))}
          </button>
          {!journeyId && (
            <button
              type="button"
              onClick={() => router.push("/app/pronunciation")}
              className="w-full rounded-2xl border border-[var(--lingo-accent-border)] bg-white px-4 py-3 text-sm font-bold text-[var(--lingo-navy)]"
            >
              {convertText(t("Practice weak sounds"))}
            </button>
          )}
        </div>
        {finishing && <p className="mt-3 text-xs text-[var(--lingo-text-muted)]">{convertText(t("Saving your progress…"))}</p>}
      </div>
    );
  }

  const errorPanel = recordError && (
    <div
      className="mt-4 rounded-2xl border p-4 text-left"
      style={{
        borderColor: recordError.kind === "rate_limit" ? "#fcd9a0" : "#f5c2bd",
        background: recordError.kind === "rate_limit" ? "#fdf3e3" : "#fdecea",
      }}
    >
      <p className="text-sm font-bold text-[var(--lingo-navy)]">
        {recordError.kind === "mic"
          ? "Microphone access needed"
          : recordError.kind === "silent"
            ? "We couldn't hear you"
            : recordError.kind === "rate_limit"
              ? "You've hit today's practice limit"
              : recordError.kind === "network"
                ? "Couldn't reach the scoring service"
                : "We couldn't score that one"}
      </p>
      <p className="mt-1 text-sm text-[var(--lingo-text)]">
        {recordError.kind === "mic"
          ? "Allow microphone access in your browser settings, then try again."
          : recordError.kind === "silent"
            ? "Try speaking a little closer to your microphone."
            : recordError.kind === "rate_limit"
              ? "Come back tomorrow — your progress is saved."
              : recordError.kind === "network"
                ? "Your recording is still here. Try scoring it again."
                : recordError.message}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {recordError.kind === "network" && recordError.audioBlob && (
          <button
            type="button"
            onClick={() => {
              setRetryBlob(recordError.audioBlob ?? null);
              setRecordError(null);
            }}
            className="rounded-xl bg-[var(--lingo-navy)] px-3 py-2 text-xs font-bold text-white"
          >
            {convertText(t("Retry scoring"))}
          </button>
        )}
        {recordError.kind !== "rate_limit" && (
          <button
            type="button"
            onClick={() => setRecordError(null)}
            className="rounded-xl border border-[var(--lingo-accent-border)] bg-white px-3 py-2 text-xs font-bold text-[var(--lingo-navy)]"
          >
            {convertText(t("Try again"))}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 md:px-6">
      {source === "weak_sounds_focus" && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold text-amber-700">
          {convertText(t("Focus: weak sounds"))}
        </div>
      )}

      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--lingo-text-muted)]">
            {convertText(t("Sentence"))} {itemIndex + 1} {convertText(t("of"))} {items.length}
          </p>
          <p className="text-[10px] font-bold tracking-[0.16em] text-[var(--lingo-blue)]">{convertText(stageLabel(phase, t))}</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--lingo-sky-pale)]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%`, background: "var(--lingo-accent-gradient)" }}
          />
        </div>
      </div>

      <div
        className="rounded-[32px] border border-[var(--lingo-accent-border)] bg-white p-6 sm:p-9"
        style={{ boxShadow: "var(--lingo-shadow-card)" }}
      >
        {phase === "sound-tip" && current.focusSyllable && (
          <>
            <div className="mb-4 flex justify-center">
              <div className="relative h-24 w-24 overflow-hidden rounded-2xl">
                <Image src="/pronunciation/huahua-coaching.png" alt="" fill className="object-cover" />
              </div>
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--lingo-blue)]">{convertText(t("Listen first"))}</p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <span className="lingo-display text-5xl font-bold text-[var(--lingo-navy)]">{convertText(current.focusSyllable)}</span>
              <SpeakerButton text={current.focusSyllable} type="word" size="md" />
            </div>
            <p className="mt-2 text-center text-sm text-[var(--lingo-text-muted)]">
              {current.focusPinyin}
              {current.focusTone != null && <span className="ml-1">{toneGlyph(current.focusTone)}</span>}
            </p>
            {toneShapeTip(current.focusTone ?? null) && (
              <div className="mt-5 flex items-start gap-2.5 rounded-2xl p-4" style={{ background: "var(--lingo-sky-pale)" }}>
                <Lightbulb size={16} className="mt-0.5 flex-shrink-0 text-[var(--lingo-blue)]" />
                <p className="text-sm leading-relaxed text-[var(--lingo-navy)]">
                  {toneShapeTip(current.focusTone ?? null)}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setPhase("word-before")}
              className="mt-8 w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-white"
              style={{ background: "var(--lingo-accent-gradient)" }}
            >
              {convertText(t("Let's practice →"))}
            </button>
          </>
        )}

        {phase === "word-before" && (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--lingo-blue)]">{convertText(t("Say the word"))}</p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <span className="lingo-display text-5xl font-bold text-[var(--lingo-navy)] sm:text-6xl">
                {convertText(current.wordHanzi)}
              </span>
              <SpeakerWithSpeed text={current.wordHanzi} type="word" size="md" />
            </div>
            {!hidden && (
              <div className="mt-3 text-center">
                <p className="text-base text-[var(--lingo-text-muted)]">{current.wordPinyin}</p>
                <p className="mt-1 text-sm text-[var(--lingo-text-muted)]">{current.wordEnglish}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setHidden((h) => !h)}
              className="mx-auto mt-3 flex items-center gap-1.5 text-xs font-bold text-[var(--lingo-text-muted)]"
            >
              {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
              {convertText(t(hidden ? "Show pinyin & translation" : "Hide pinyin & translation"))}
            </button>
            <div className="mt-8 flex justify-center">
              {!recordError && (
                <RecordButton
                  sessionId={sessionId}
                  unitType="word"
                  targetText={current.wordHanzi}
                  targetPinyin={current.wordPinyin}
                  onRecorded={handleRecorded}
                  onScored={(result) => {
                    trackScore(result);
                    setWordResult(result);
                    setPhase("word-feedback");
                  }}
                  onError={handleScoreError}
                  retryBlob={retryBlob}
                  onRetryConsumed={() => setRetryBlob(null)}
                />
              )}
            </div>
            {errorPanel}
          </>
        )}

        {phase === "word-feedback" && wordResult && (
          <PronunciationFeedback
            result={wordResult}
            recordedAudioUrl={recordedUrlState}
            mode="word"
            onRetry={() => {
              setRecordError(null);
              setPhase("word-before");
            }}
            onContinue={() => {
              setRecordError(null);
              setPhase("sentence-before");
            }}
            continueLabel={convertText(t("Continue to sentence →"))}
          />
        )}

        {phase === "sentence-before" && (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--lingo-blue)]">{convertText(t("Now say the sentence"))}</p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-0.5 gap-y-1">
              {Array.from(current.sentenceHanzi).map((char, index) => {
                if (!/[\u4e00-\u9fff\u3400-\u4dbfA-Za-z]/.test(char)) {
                  return (
                    <span key={index} className="text-3xl font-semibold text-[var(--lingo-navy)]">
                      {convertText(char)}
                    </span>
                  );
                }
                return (
                  <SpeakerButton
                    key={index}
                    text={char}
                    type="word"
                    size="sm"
                    className="!h-auto !w-auto !rounded-lg !border-transparent !bg-transparent !px-0.5 !py-0.5 !text-3xl !font-semibold !text-[var(--lingo-navy)] hover:!bg-[var(--lingo-sky-pale)] hover:!border-transparent"
                    label={convertText(char)}
                  />
                );
              })}
            </div>
            {!hidden && (
              <div className="mt-3 text-center">
                <p className="text-base text-[var(--lingo-text-muted)]">{current.sentencePinyin}</p>
                <p className="mt-1 text-sm text-[var(--lingo-text-muted)]">{current.sentenceEnglish}</p>
              </div>
            )}
            <div className="mt-4 flex items-center justify-center gap-3">
              <SpeakerWithSpeed text={current.sentenceHanzi} type="sentence" size="md" />
              <button
                type="button"
                onClick={() => setHidden((h) => !h)}
                className="flex items-center gap-1.5 text-xs font-bold text-[var(--lingo-text-muted)]"
              >
                {hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                {convertText(t(hidden ? "Show" : "Hide"))}
              </button>
            </div>
            <div className="mt-8 flex justify-center">
              {!recordError && (
                <RecordButton
                  sessionId={sessionId}
                  unitType="sentence"
                  targetText={current.sentenceHanzi}
                  targetPinyin={current.sentencePinyin}
                  onRecorded={handleRecorded}
                  onScored={(result) => {
                    trackScore(result);
                    setSentenceResult(result);
                    setPhase("sentence-feedback");
                  }}
                  onError={handleScoreError}
                  retryBlob={retryBlob}
                  onRetryConsumed={() => setRetryBlob(null)}
                />
              )}
            </div>
            {errorPanel}
          </>
        )}

        {phase === "sentence-feedback" && sentenceResult && (
          <PronunciationFeedback
            result={sentenceResult}
            recordedAudioUrl={recordedUrlState}
            mode="sentence"
            onRetry={() => {
              setRecordError(null);
              setPhase("sentence-before");
            }}
            onIsolateSyllable={(syllable) => {
              setIsolateSyllable(coerceIsolateTarget(syllable));
              setPhase("isolate-before");
            }}
            onContinue={() => void goToNextItem()}
            continueLabel={convertText(t(itemIndex + 1 < items.length ? "Next sentence →" : "Finish practice →"))}
            forcedSyllable={
              current.focusSyllable
                ? isolateForForced(sentenceResult.characters, {
                    hanzi: current.focusSyllable,
                    pinyin: current.focusPinyin ?? null,
                    targetTone: current.focusTone ?? null,
                  })
                : null
            }
          />
        )}

        {phase === "isolate-before" && isolateTarget && (
          <>
            <div className="mb-2 flex justify-center">
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl">
                <Image src="/pronunciation/huahua-coaching.png" alt="" fill className="object-cover" />
              </div>
            </div>
            <p className="text-center text-xs font-bold uppercase tracking-[0.12em] text-[var(--lingo-blue)]">
              {convertText(t("Let's fix one sound"))}
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <span className="lingo-display text-5xl font-bold text-[var(--lingo-navy)]">
                {convertText(isolateTarget.practiceText)}
              </span>
              <SpeakerButton text={isolateTarget.practiceText} type="word" size="md" />
            </div>
            {(isolateTarget.practicePinyin || isolateTarget.pinyin) && (
              <p className="mt-2 text-center text-sm text-[var(--lingo-text-muted)]">
                {isolateTarget.practicePinyin ?? isolateTarget.pinyin} {toneGlyph(isolateTarget.targetTone)}
              </p>
            )}
            {isolateTarget.sandhiApplied &&
              isolateTarget.pinyin &&
              isolateTarget.citationPinyin &&
              isolateTarget.pinyin !== isolateTarget.citationPinyin && (
                <p className="mt-2 text-center text-xs text-[var(--lingo-text-muted)]">
                  {isolateTarget.hanzi} is spoken as {isolateTarget.pinyin} here — not{" "}
                  {isolateTarget.citationPinyin}.
                </p>
              )}
            {(() => {
              const guide = primaryGuide({
                tone: isolateTarget.targetTone,
                pinyin: isolateTarget.pinyin,
              });
              const tip = toneShapeTip(isolateTarget.targetTone);
              if (!guide && !tip) return null;
              return (
                <ol className="mx-auto mt-5 max-w-md list-decimal space-y-2 rounded-2xl p-4 pl-8 text-sm text-[var(--lingo-text)]" style={{ background: "var(--lingo-sky-pale)" }}>
                  {(guide?.steps ?? [tip!]).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              );
            })()}
            <div className="mt-8 flex justify-center">
              {!recordError && (
                <RecordButton
                  sessionId={sessionId}
                  unitType="syllable_drill"
                  targetText={isolateTarget.practiceText}
                  targetPinyin={isolateTarget.practicePinyin ?? isolateTarget.pinyin ?? undefined}
                  onRecorded={handleRecorded}
                  onScored={(result) => {
                    trackScore(result);
                    setIsolateResult(result);
                    setPhase("isolate-feedback");
                  }}
                  onError={handleScoreError}
                  retryBlob={retryBlob}
                  onRetryConsumed={() => setRetryBlob(null)}
                />
              )}
            </div>
            {errorPanel}
            <button
              type="button"
              onClick={() => setPhase("sentence-before")}
              className="mx-auto mt-5 block text-xs font-bold text-[var(--lingo-blue)]"
            >
              {convertText(t("Try the whole sentence again"))}
            </button>
          </>
        )}

        {phase === "isolate-feedback" && isolateResult && (
          <PronunciationFeedback
            result={isolateResult}
            recordedAudioUrl={recordedUrlState}
            mode="isolate"
            onRetry={() => {
              setRecordError(null);
              setPhase("isolate-before");
            }}
            onContinue={() => setPhase("sentence-before")}
            continueLabel={convertText(t("Back to the sentence →"))}
          />
        )}
      </div>
    </div>
  );
}
