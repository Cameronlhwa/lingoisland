"use client";

import { useEffect, useRef, useState } from "react";
import ScoreCelebration from "./ScoreCelebration";
import { celebrationSoundEnabled, setCelebrationSoundEnabled, prepareCelebrationSound, stopCelebrationSound } from "@/lib/pronunciation/celebration";
import Link from "next/link";
import {usePathname,useSearchParams} from "next/navigation";
import {lessonForTone,safeCourseReturn} from "@/lib/pronunciation/course/progress";
import Button from "@/components/ui/Button";
import styles from "./PronunciationFeedback.module.css";
import { Check, MessageCircle, Volume2, VolumeX } from "lucide-react";
import {
  bandForScore,
  feedbackHeadline,
  pickEncouragement,
  toneGlyph,
  toneName,
  toneShapeTip,
} from "@/lib/pronunciation/encouragement";
import { primaryGuide } from "@/lib/pronunciation/soundGuides";
import type { ScoreResult } from "@/components/app/Pronunciation/RecordButton";
import SpeakerButton from "@/components/app/SpeakerButton";
import {
  pickIsolateFocus,
  type IsolateTarget,
} from "@/lib/pronunciation/isolateTarget";
import { scoreTierStyle } from "@/lib/pronunciation/weakSoundTypes";

export default function PronunciationFeedback({
  result,
  recordedAudioUrl,
  onRetry,
  onIsolateSyllable,
  onContinue,
  continueLabel,
  forcedSyllable,
  mode = "word",
  layout = "default",
  disabled = false,
}: {
  result: ScoreResult;
  recordedAudioUrl?: string | null;
  onRetry: () => void;
  onIsolateSyllable?: (syllable: IsolateTarget) => void;
  onContinue: () => void;
  continueLabel: string;
  forcedSyllable?: IsolateTarget | { hanzi: string; pinyin: string | null; targetTone: number | null } | null;
  mode?: "word" | "sentence" | "isolate";
  layout?: "default" | "lesson";
  disabled?: boolean;
}) {
  const pathname=usePathname();const search=useSearchParams();
  const band = bandForScore(result.overallScore);
  const encouragement = band ? pickEncouragement(band, result.attemptId.length) : null;
  const focus = pickIsolateFocus(result.characters, result.weakSyllables, forcedSyllable);
  const tip = focus ? toneShapeTip(focus.targetTone, focus) : null;
  const guide = focus ? primaryGuide({ ...focus, tone: focus.targetTone }) : null;
  const isStrong = band === "strong";
  const isLesson = layout === "lesson";
  const scoreRef = useRef<HTMLDivElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!result.newlyScored || document.hidden) return;
    const feedback = feedbackRef.current;
    const rect = feedback?.getBoundingClientRect();
    if (feedback && rect && rect.bottom > innerHeight - 96) {
      feedback.scrollIntoView({ block: "end", behavior: "instant" });
    }
  }, [result.attemptId, result.newlyScored]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  useEffect(() => { setSoundEnabled(celebrationSoundEnabled()); }, []);
  const toggleSound = () => {
    const enabled = !soundEnabled;
    setSoundEnabled(enabled);
    setCelebrationSoundEnabled(enabled);
    if (enabled) prepareCelebrationSound();
  };

  return (
    <div ref={feedbackRef} className="flex min-w-0 scroll-mb-24 flex-col gap-3">
      <ScoreCelebration key={result.attemptId} result={result} anchorRef={scoreRef} />
      <div className={isLesson ? styles.summary : "flex flex-wrap items-start gap-4"}
        data-strong={isStrong || undefined}>
        {isLesson && <span className={styles.resultIcon} aria-hidden="true">
          {isStrong ? <Check size={24} strokeWidth={3} /> : <MessageCircle size={22} />}
        </span>}
        <div className={isLesson ? styles.copy : "min-w-0 flex-1"}>
          <div className="flex items-center gap-2">
            {!isLesson && <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--lingo-blue)]">
              {mode === "sentence" ? "Sentence" : mode === "isolate" ? "Sound check" : "Word"}
            </p>}
            {isLesson && <h2 className="lingo-display text-xl font-bold text-[var(--lingo-navy)] sm:text-2xl">
              {feedbackHeadline(band)}
            </h2>}
            <button type="button" onClick={toggleSound} aria-label="Celebration sound" aria-pressed={soundEnabled}
              title={soundEnabled ? "Mute celebration sounds" : "Turn on celebration sounds"}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--lingo-text-muted)] hover:bg-[var(--lingo-sky-pale)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--lingo-teal)]">
              {soundEnabled ? <Volume2 size={16} aria-hidden="true" /> : <VolumeX size={16} aria-hidden="true" />}
            </button>
          </div>
          {!isLesson && <h2 className="lingo-display mt-1 text-2xl font-bold text-[var(--lingo-navy)]">
            {feedbackHeadline(band)}
          </h2>}
          <p className="mt-1 text-sm text-[var(--lingo-text-muted)]">{encouragement}</p>
        </div>
        <div ref={scoreRef} aria-label={result.overallScore === null ? "Pronunciation score unavailable" : `Pronunciation score: ${Math.round(result.overallScore)} out of 100`}
          className={`${isLesson ? styles.score : ""} lingo-display flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl text-lg font-bold`}
          style={scoreTierStyle(result.overallScore)}>
          {result.overallScore === null ? "—" : Math.round(result.overallScore)}
        </div>
        {result.characters.length > 0 && <div className={isLesson ? styles.characters : "order-last flex w-full flex-wrap justify-center gap-1.5"} aria-label="Syllable feedback">
          {result.characters.map((character, index) => <span key={`${character.hanzi}-${index}`}
            className="flex min-w-[2.75rem] flex-col items-center rounded-xl px-2 py-1.5"
            style={scoreTierStyle(character.score)}>
            <span lang="zh-CN" className="text-base font-bold leading-tight">{character.hanzi}</span>
            {character.pinyin && <span className="mt-0.5 text-[11px] font-medium leading-none opacity-80">{character.pinyin}</span>}
          </span>)}
        </div>}
      </div>

      {focus && (!isStrong || (focus.score !== null && focus.score < 80)) && (
        <div
          className="rounded-[22px] border p-4"
          style={{ borderColor: "var(--lingo-border)", background: "var(--lingo-sky-pale)" }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--lingo-blue)]">
            Focus on this
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="lingo-display text-3xl font-bold text-[var(--lingo-navy)]">{focus.practiceText}</span>
            <div>
              <p className="text-sm font-semibold text-[var(--lingo-navy)]">
                {focus.practicePinyin ?? focus.pinyin ?? focus.hanzi}
                {focus.targetTone != null && (
                  <span className="ml-1.5 text-[var(--lingo-text-muted)]">
                    {toneGlyph(focus.targetTone)} {toneName(focus.targetTone)}
                  </span>
                )}
              </p>
              {focus.sandhiApplied && focus.pinyin && focus.citationPinyin && focus.pinyin !== focus.citationPinyin && (
                <p className="mt-1 text-xs text-[var(--lingo-text-muted)]">
                  {focus.hanzi} is written {focus.citationPinyin} and spoken {focus.pinyin} here.
                </p>
              )}
              {(tip || guide?.shortTip) && (
                <p className="mt-1 max-w-md text-sm leading-relaxed text-[var(--lingo-text)]">
                  {tip ?? guide?.shortTip}
                </p>
              )}
            </div>
            <SpeakerButton text={focus.practiceText} type="word" size="md" />
          </div>
          {guide?.commonMistake && (
            <p className="mt-3 text-xs text-[var(--lingo-text-muted)]">
              Common slip: {guide.commonMistake}
            </p>
          )}
          {!pathname?.startsWith("/app/pronunciation/learn")&&<Link href={`/app/pronunciation/learn/${lessonForTone(focus.targetTone,focus.sandhiApplied)}?returnTo=${encodeURIComponent(safeCourseReturn((pathname??"/app/pronunciation/practice")+(search.toString()?"?"+search.toString():"")))}`} className="mt-4 inline-block text-sm font-semibold text-[var(--lingo-teal)] underline">Review this tone lesson</Link>}
        </div>
      )}

      <div className={isLesson ? styles.actions : "sticky bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] z-20 rounded-2xl border border-[var(--lingo-border)] bg-white p-3 shadow-sm md:bottom-4"}>
      <div className={isLesson ? styles.secondaryActions : "mb-3 flex flex-wrap gap-2"}>

        {recordedAudioUrl && (
          <Button variant="secondary" size="compact" disabled={disabled}
            onClick={() => { stopCelebrationSound(); void new Audio(recordedAudioUrl).play().catch(() => {}); }}>
            <Volume2 size={14} aria-hidden="true" /> Listen back
          </Button>
        )}
        <Button variant="secondary" size="compact" disabled={disabled} onClick={onRetry}>
          Try again
        </Button>
        {focus && onIsolateSyllable && mode !== "isolate" && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onIsolateSyllable(focus)}
            className="min-h-11 rounded-xl bg-[var(--lingo-navy)] px-3.5 py-2.5 text-xs font-bold text-white"
          >
            Practice {focus.practiceText}
          </button>
        )}
      </div>

      <Button onClick={onContinue} disabled={disabled} className={isLesson ? styles.continue : "w-full"}>
        {continueLabel}
      </Button>
      </div>
    </div>
  );
}
